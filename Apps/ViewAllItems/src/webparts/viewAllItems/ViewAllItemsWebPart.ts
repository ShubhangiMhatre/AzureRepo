import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import {
  BaseClientSideWebPart,
  IPropertyPaneConfiguration,
  PropertyPaneDropdown,
  IPropertyPaneDropdownOption
} from '@microsoft/sp-webpart-base';

import * as strings from 'ViewAllItemsWebPartStrings';
import ViewAllItems from './components/ViewAllItems';
import { IViewAllItemsProps } from './components/IViewAllItemsProps';
import { IList } from './services/IList';
import { IListColumn } from './services/IListColumn';
import { ListService } from './services/ListService';
import { MultiSelectBuilder, IItemProp, PropertyPaneMultiSelect } from './CustomPropertyPane/PropertyPaneMultiSelect';
import { IDropdownOption } from 'office-ui-fabric-react/lib/components/Dropdown';

export interface IViewAllItemsWebPartProps {
  listName: string;
  selectedIds: string[];
  selectedColumnsAndType: IItemProp[];
  pageSize: number;
  selectedGroupByIds: string[];
  selectedGroupColumnsAndType: IItemProp[];
}

export default class ViewAllItemsWebPart extends BaseClientSideWebPart<IViewAllItemsWebPartProps> {

  private lists: IPropertyPaneDropdownOption[];
  //private columnsDropdown: PropertyPaneMultiSelect;
  private listsDropdownDisabled: boolean = true;

  protected onInit(): Promise<void> {
    this.configureWebPart = this.configureWebPart.bind(this);
    this.loadColumns = this.loadColumns.bind(this);
    this.selectedColumns = this.selectedColumns.bind(this);
    this.loadGroupByColumns = this.loadGroupByColumns.bind(this);
    this.selectedGrupByColumns=this.selectedGrupByColumns.bind(this);
    return super.onInit();
  }

  protected onPropertyPaneConfigurationStart(): void {
    this.listsDropdownDisabled = !this.lists;

    if (this.lists) {
      return;
    }

    this.context.statusRenderer.displayLoadingIndicator(this.domElement, 'lists');

    this.loadLists()
      .then((listOptions: IPropertyPaneDropdownOption[]): void => {
        this.lists = listOptions;
        this.listsDropdownDisabled = false;
        this.context.propertyPane.refresh();
        this.context.statusRenderer.clearLoadingIndicator(this.domElement);
        this.render();
      });
  }

  protected onPropertyPaneFieldChanged(propertyPath: string, oldValue: any, newValue: any): void {
    if (propertyPath === 'listName' && newValue) {
      // push new list value
      super.onPropertyPaneFieldChanged(propertyPath, oldValue, newValue);
      // get previously selected column
      const previousItem: string[] = this.properties.selectedIds;
      // reset selected item
      this.properties.selectedIds = [];
      // push new item value
      this.onPropertyPaneFieldChanged('selectedIds', previousItem, this.properties.selectedIds);

      //this.columnsDropdown.render(this.domElement);

      this.render();
      // refresh the item selector control by repainting the property pane
      this.context.propertyPane.refresh();

    }
    else {
      super.onPropertyPaneFieldChanged(propertyPath, oldValue, newValue);
    }
  }
  protected onPropertyPaneGroupFieldChanged(propertyPath: string, oldValue: any, newValue: any): void {
    if (propertyPath === 'listName' && newValue) {
      // push new list value
      super.onPropertyPaneFieldChanged(propertyPath, oldValue, newValue);
      // get previously selected column
      const previousItem: string[] = this.properties.selectedGroupByIds;
      // reset selected item
      this.properties.selectedGroupByIds = [];
      // push new item value
      this.onPropertyPaneGroupFieldChanged('selectedIds', previousItem, this.properties.selectedGroupByIds);

      //this.columnsDropdown.render(this.domElement);

      this.render();
      // refresh the item selector control by repainting the property pane
      this.context.propertyPane.refresh();

    }
    else {
      super.onPropertyPaneFieldChanged(propertyPath, oldValue, newValue);
    }
  }
  public render(): void {
    const element: React.ReactElement<IViewAllItemsProps> = React.createElement(
      ViewAllItems,
      {
        spHttpClient: this.context.spHttpClient,
        siteUrl: this.context.pageContext.web.absoluteUrl,
        listName: this.properties.listName,
        needsConfiguration: this.needsConfiguration(),
        configureWebPart: this.configureWebPart,
        displayMode: this.displayMode,
        selectedColumns: this.selectedColumns(),
        pageSize: this.properties.pageSize,
        selectedGroupByColumns:this.selectedGrupByColumns()
      }
    );

    ReactDom.render(element, this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    const newLocal = "selectedGroupByIds";
    return {
      pages: [
        {
          header: {
            description: strings.PropertyPaneDescription
          },
          groups: [
            {
              groupName: strings.BasicGroupName,
              groupFields: [
                PropertyPaneDropdown('listName', {
                  label: strings.ListNameFieldLabel,
                  options: this.lists,
                  disabled: this.listsDropdownDisabled,

                }),
                PropertyPaneMultiSelect("selectedIds", {
                  label: "Select Columns",
                  selectedItemIds: this.properties.selectedIds, //Ids of Selected Items
                  onload: () => this.loadColumns(), //On load function to items for drop down 
                  onPropChange: this.onPropertyPaneFieldChanged, // On Property Change function
                  properties: this.properties, //Web Part properties
                  key: "targetkey",  //unique key
                  disabled: !this.properties.listName
                }),
                PropertyPaneMultiSelect(newLocal, {
                  label: "Select Groupby Columns",
                  selectedItemIds: this.properties.selectedGroupByIds, //Ids of Selected Items
                  onload: () => this.loadGroupByColumns(), //On load function to items for drop down 
                  onPropChange: this.onPropertyPaneGroupFieldChanged, // On Property Change function
                  properties: this.properties, //Web Part properties
                  key: "targetGroupkey",  //unique key
                  disabled: !this.properties.listName
                }),
                PropertyPaneDropdown('pageSize', {
                  label: strings.PageSizeFieldLabel,
                  options: [
                    { key: '10', text: '10' },
                    { key: '25', text: '25' },
                    { key: '50', text: '50' },
                    { key: '100', text: '100' }
                  ]
                })
              ]
            }
          ]
        }
      ]
    };
  }

  protected get disableReactivePropertyChanges(): boolean {
    return true;
  }

  private loadLists(): Promise<IPropertyPaneDropdownOption[]> {
    const dataService = new ListService(this.context);

    return new Promise<IPropertyPaneDropdownOption[]>(resolve => {
      dataService.getLists()
        .then((response: IList[]) => {
          var options: IPropertyPaneDropdownOption[] = [];

          response.forEach((item: IList) => {
            options.push({ "key": item.Title, "text": item.Title });
          });

          resolve(options);
        });
    });
  }

  private loadColumns(): Promise<IItemProp[]> {
    if (!this.properties.listName) {
      // resolve to empty options since no list has been selected
      return Promise.resolve();
    }
    const dataService = new ListService(this.context);

    return new Promise<IItemProp[]>(resolve => {
      dataService.getColumns(this.properties.listName)
        .then((response) => {
          var options: IItemProp[] = [];
          this.properties.selectedColumnsAndType = [];
          response.forEach((column: IListColumn) => {
            options.push({ "key": column.StaticName, "text": column.Title });
            this.properties.selectedColumnsAndType.push({ "key": column.StaticName, "text": column.TypeDisplayName });
          });

          resolve(options);
        });
    });
  }

  private loadGroupByColumns(): Promise<IItemProp[]> {
    if (!this.properties.listName) {
      // resolve to empty options since no list has been selected
      return Promise.resolve();
    }
    const dataService = new ListService(this.context);

    return new Promise<IItemProp[]>(resolve => {
      dataService.getColumns(this.properties.listName)
        .then((response) => {
          var options: IItemProp[] = [];
          this.properties.selectedGroupColumnsAndType = [];
          response.forEach((column: IListColumn) => {
            options.push({ "key": column.StaticName, "text": column.Title });
            this.properties.selectedGroupColumnsAndType.push({ "key": column.StaticName, "text": column.TypeDisplayName });
          });

          resolve(options);
        });
    });
  }
  private needsConfiguration(): boolean {
    return this.properties.listName === null ||
      this.properties.listName === undefined ||
      this.properties.listName.trim().length === 0 ||
      this.properties.selectedIds === null ||
      this.properties.selectedIds === undefined ||
      this.properties.selectedIds.length === 0;
  }

  private selectedColumns(): IItemProp[] {
    if (this.properties.selectedColumnsAndType === null ||
      this.properties.selectedColumnsAndType === undefined ||
      this.properties.selectedColumnsAndType.length === 0) {
      return [];
    }
    else {
      return this.properties.selectedColumnsAndType.filter(obj => this.properties.selectedIds.indexOf(obj.key) !== -1);
    }
  }


  private selectedGrupByColumns(): IItemProp[] {
    if (this.properties.selectedGroupColumnsAndType === null ||
      this.properties.selectedGroupColumnsAndType === undefined ||
      this.properties.selectedGroupColumnsAndType.length === 0) {
      return [];
    }
    else {
      return this.properties.selectedGroupColumnsAndType.filter(obj => this.properties.selectedGroupByIds.indexOf(obj.key) !== -1);
    }  }

  private configureWebPart(): void {
    this.context.propertyPane.open();
  }
}

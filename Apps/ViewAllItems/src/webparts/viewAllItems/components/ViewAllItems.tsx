import * as React from 'react';
import styles from './ViewAllItems.module.scss';
import { IViewAllItemsProps } from './IViewAllItemsProps';
import { escape } from '@microsoft/sp-lodash-subset';
import { autobind } from 'office-ui-fabric-react/lib/Utilities';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import {

  DetailsList,
  IColumn,
  buildColumns,
  DetailsListLayoutMode as LayoutMode,
  ConstrainMode,
  CheckboxVisibility,
  SelectionMode,
  IGroup
} from 'office-ui-fabric-react/lib/DetailsList';
import {
  TextField
} from 'office-ui-fabric-react/lib/TextField';
import { Selection } from 'office-ui-fabric-react/lib/Selection';
import { Stack } from 'office-ui-fabric-react/lib/Stack';
import { Text } from 'office-ui-fabric-react/lib/Text';
import { Config } from './Config/Config';
import Paging from './Paging/Paging';
import { IItemProp } from '../CustomPropertyPane/PropertyPaneMultiSelect';

export interface IViewAllItemsState {
 
  items?: any[];
  columns?: IColumn[];
  status?: string;
  currentPage?: number;
  itemCount?: number;
  pageSize?: number;
  isLoading: boolean;
  subreddit: any;
  nextPageToken: any;
  groups?:IGroup[];
}
export default class ViewAllItems extends React.Component<IViewAllItemsProps, IViewAllItemsState> {
  private selectQuery: string[] = [];
  private expandQuery: string[] = [];

  private _selection;
  constructor(props: IViewAllItemsProps) {
    super(props);
    this._selection = new Selection({
      onSelectionChanged: () => this.forceUpdate()
    });
    const SUBREDDIT = 'bostonterriers';
    const THUMBSIZE = 80;
    const groups: IGroup[] = [];
    this.state = {
     
      items: [],
      columns: this.buildColumns(this.props),
      currentPage: 1,
      pageSize: this.props.pageSize,
      isLoading: false,
      subreddit: SUBREDDIT,
      nextPageToken: undefined,
      groups:[]
    };
    this._onPageUpdate = this._onPageUpdate.bind(this);
    //this._onFilter = this._onFilter.bind(this);  
    this.getListItemsCount(`${this.props.siteUrl}/_api/web/lists/GetByTitle('${props.listName}')/ItemCount`);
    const queryParam = this.buildQueryParams(props);
    this.readItems(`${this.props.siteUrl}/_api/web/lists/GetByTitle('${props.listName}')/items${queryParam}`);
  } 
  
  public componentWillReceiveProps(nextProps: IViewAllItemsProps): void {

    this.setState({
      columns: this.buildColumns(nextProps),
      pageSize: nextProps.pageSize ,
      groups:this.groupBy(this.props)   
    });
    this.getListItemsCount(`${this.props.siteUrl}/_api/web/lists/GetByTitle('${this.props.listName}')/ItemCount`);
    //const selectColumns = nextProps.selectedColumns === null || nextProps.selectedColumns===undefined || nextProps.selectedColumns.length === 0? "" : '?$select='+nextProps.selectedColumns.join();
    const queryParam = this.buildQueryParams(nextProps);
    this.readItems(`${this.props.siteUrl}/_api/web/lists/GetByTitle('${nextProps.listName}')/items${queryParam}`);
  }

  public render(): JSX.Element {
    const { needsConfiguration, configureWebPart } = this.props;
    let { items, columns, pageSize,groups } = this.state;
    //const filteredRows = !filter ? items : items.filter(row => row && row.title.toLowerCase().indexOf(filter.toLowerCase()) >= 0);
    return (
      <div className={styles.viewAllItems}>
        <div>
          {needsConfiguration &&
            <Config configure={configureWebPart} {...this.props} />
          }
          {needsConfiguration === false &&
            <div>
              <div>
                <div>
                  <div className={styles.status}>{this.state.status}</div>
                  <Paging
                    totalItems={this.state.itemCount}
                    itemsCountPerPage={this.state.pageSize}
                    onPageUpdate={this._onPageUpdate}
                    currentPage={this.state.currentPage} />
                  <div></div>
                  <Stack gap={8}>
                    <TextField label="Filter by title:"
                     // onChange={this._onFilter} 
                      //onChange={(ev, filter) => this.setState({  items: filter ? this.state.items.filter(i => i.toLowerCase().indexOf(filter) > -1) : this.state.items })}
                    />
                    <Text variant='small'>Filtered items: {items.length}, total items: {this.state.itemCount}, selected: {this._selection.count}</Text>
                  </Stack>
                  <DetailsList
                    items={items}
                    columns={columns}
                    groups={groups }
                    isHeaderVisible={true}
                    layoutMode={LayoutMode.justified}
                    constrainMode={ConstrainMode.unconstrained}
                    checkboxVisibility={CheckboxVisibility.hidden}
                    onColumnHeaderClick={this._onColumnClick}
                    selectionMode={SelectionMode.multiple}

                  />
                </div>
              </div>
            </div>
          }
        </div>
      </div>
    );
  }
  private old(props: IViewAllItemsProps): IGroup[] {
    const columns: IGroup[] = [];
    props.selectedGroupByColumns.forEach((element ,index)=> {
      if (element.text === "Person or Group" || element.text === "Lookup") {
        const column: IGroup = {
          key: 'group' + element.key,
          name: `By "${ element.key.indexOf("_x0020_") !== -1 ? element.key.replace("_x0020_", " ") : element.key}"`,          
          startIndex: index,
          level: 0,
          count: 0
        };
        columns.push(column);
      }
      else {
        const column: IGroup = {
          key: 'group' + element.key,
          name: `By "${ element.key.indexOf("_x0020_") !== -1 ? element.key.replace("_x0020_", " ") : element.key}"`,          
          startIndex: index,
          level: 0,
          count: 0
        };
        columns.push(column);
      }
    });
    return columns;
  }
  private groupBy(props: IViewAllItemsProps) :IGroup[]{
   
    let groups = this.state.items.reduce((currentGroups, currentItem, index) => {

      let lastGroup = currentGroups[currentGroups.length - 1];
      props.selectedGroupByColumns.forEach(element=> {
        let fieldValue = currentItem[element.key];
        if (!lastGroup || lastGroup.value !== fieldValue) {
          currentGroups.push({
            key: 'group' + fieldValue + index,
            name: `By "${ fieldValue }"`,
            value: fieldValue,
            startIndex: index,
            level: 0,
            count: 0
          });
        }
      });   
      
      if (lastGroup) {
        lastGroup.count = index - lastGroup.startIndex;
      }
      return currentGroups;
    }, []);
  
    // Fix last group count
    let newlastGroup = groups[groups.length - 1];
    
    if (newlastGroup) {
      newlastGroup.count = this.state.items.length - newlastGroup.startIndex;
    }
    
    return groups;
  }

  private  transform(itemList:any[], searchKeyword:string) {    
    if (!itemList)
      return [];
    if (!searchKeyword && searchKeyword==="")
      return itemList;
    let filteredList:any[]=[];
    if (itemList.length > 0) {
      searchKeyword = searchKeyword.toLowerCase();      
      itemList.forEach(item => {
        //Object.values(item) => gives the list of all the property values of the 'item' object
        let propValueList = Object.keys(item).map(k =>item[k]);        
        for(let i=0;i<propValueList.length;i++)
        {
          if (propValueList[i]) {
            
            if (propValueList[i].toString().toLowerCase().indexOf(searchKeyword) > -1)
            {
              filteredList.push(item);
              break;
            }
          }
        }
      });
    }
    console.log("filteredList:",filteredList);
    return filteredList;
  }
  private _onFilter = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string): void => {
   const result=this.transform(this.state.items,newValue);    
    this.setState({ items: newValue ? result : this.state.items});
      
   
    // this.setState({
    //   //items:this.filterByValue(this.state.items,newValue)
    //   items: newValue ? this.transform(this.state.items,newValue) : this.state.items
    // });
  }
  private readItems(url: string) {
    this.setState({
      items: [],
      status: 'Loading all items...'
    });

    this.props.spHttpClient.get(url,
      SPHttpClient.configurations.v1,
      {
        headers: {
          'Accept': 'application/json;odata=nometadata',
          'odata-version': ''
        }
      }).then((response: SPHttpClientResponse): Promise<{ value: any[] }> => {
        return response.json();
      }).then((response: { value: any[] }): void => {
        //this.props.Status(`${response.d.__next}`);
        //this.props.siteUrl = response['odata.nextLink'];
        this.setState({
          items: response.value,
          //columns: _buildColumns(response.value),
          status: `Showing items ${(this.state.currentPage - 1) * this.props.pageSize + 1} - ${(this.state.currentPage - 1) * this.props.pageSize + response.value.length} of ${this.state.itemCount}`
        });
      }, (error: any): void => {
        this.setState({
          items: [],
          status: 'Loading all items failed with error: ' + error
        });
      });

  }

  private getListItemsCount(url: string) {
    this.props.spHttpClient.get(url, SPHttpClient.configurations.v1,
      {
        headers: {
          'Accept': 'application/json;odata=nometadata',
          'odata-version': ''
        }
      }).then((response: SPHttpClientResponse): Promise<{ value: number }> => {
        return response.json();
      }).then((response: { value: number }): void => {
        this.setState({
          itemCount: response.value
        });
      });
  }
  private listNotConfigured(props: IViewAllItemsProps): boolean {
    return props.listName === undefined ||
      props.listName === null ||
      props.listName.length === 0;
  }

  private _onPageUpdate(pageNumber: number) {
    //this.readItems()
    this.setState({
      currentPage: pageNumber,
    });
    const p_ID = (pageNumber - 1) * this.props.pageSize;
    const selectColumns = '&$select=' + this.selectQuery;
    const expandColumns = '&$expand=' + this.expandQuery;
    const queryParam = `%24skiptoken=Paged%3dTRUE%26p_ID=${p_ID}&$top=${this.props.pageSize}`;
    var url = `${this.props.siteUrl}/_api/web/lists/GetByTitle('${this.props.listName}')/items?` + queryParam + selectColumns + expandColumns;
    this.readItems(url);
  }

  @autobind
  private _onColumnClick(event: React.MouseEvent<HTMLElement>, column: IColumn) {
    let { items, columns } = this.state;
    let isSortedDescending = column.isSortedDescending;

    // If we've sorted this column, flip it.
    if (column.isSorted) {
      isSortedDescending = !isSortedDescending;
    }

    // Sort the items.
    items = items!.concat([]).sort((a, b) => {
      let firstValue = a[column.fieldName];
      let secondValue = b[column.fieldName];

      if (isSortedDescending) {
        return firstValue > secondValue ? -1 : 1;
      } else {
        return firstValue > secondValue ? 1 : -1;
      }
    });

    // Reset the items and columns to match the state.
    this.setState({
      items: items,
      columns: columns!.map(col => {
        col.isSorted = (col.key === column.key);

        if (col.isSorted) {
          col.isSortedDescending = isSortedDescending;
        }
        return col;
      })
    });
  }

  private buildQueryParams(props: IViewAllItemsProps): string {
    this.selectQuery = [];
    this.expandQuery = [];
    props.selectedColumns.forEach(element => {
      if (element.text === "Person or Group" || element.text === "Lookup") {
        this.selectQuery.push(element.key + "/Title");
        this.expandQuery.push(element.key);
      }
      else {
        this.selectQuery.push(element.key);
      }
    });
    const queryParam = `?%24skiptoken=Paged%3dTRUE%26p_ID=1&$top=${props.pageSize}`;
    const selectColumns = this.selectQuery === null || this.selectQuery === undefined || this.selectQuery.length === 0 ? "" : '&$select=' + this.selectQuery.join();
    const expandColumns = this.expandQuery === null || this.expandQuery === undefined || this.expandQuery.length === 0 ? "" : '&$expand=' + this.expandQuery.join();
    return queryParam + selectColumns + expandColumns;
  }
  private buildColumns(props: IViewAllItemsProps): IColumn[] {
    const columns: IColumn[] = [];
    props.selectedColumns.forEach(element => {
      if (element.text === "Person or Group" || element.text === "Lookup") {
        const column: IColumn = {
          key: element.key,
          name: element.key.indexOf("_x0020_") !== -1 ? element.key.replace("_x0020_", " ") : element.key,
          fieldName: element.key,
          minWidth: 100,
          maxWidth: 350,
          isResizable: true,
          data: 'string',
          onRender: (item: any) => {
            return (
              <span>
                {item[element.key]["Title"]}
              </span>
            );
          }
        };
        columns.push(column);
      }
      else {
        const column: IColumn = {
          key: element.key,
          name: element.key.indexOf("_x0020_") !== -1 ? element.key.replace("_x0020_", " ") : element.key,
          fieldName: element.key,
          minWidth: 100,
          maxWidth: 350,
          isResizable: true,
          data: 'string',
          isMultiline: element.text === "Multiple lines of text" ? true : false
        };
        columns.push(column);
      }
    });
    return columns;
  }
}


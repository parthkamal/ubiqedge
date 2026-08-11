import Table from '@cloudscape-design/components/table';
import Pagination from '@cloudscape-design/components/pagination';
import TextFilter from '@cloudscape-design/components/text-filter';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';

// shared shape behind every paginated/searchable admin list screen (Users,
// Devices, Pricing, Invoices) — reduces each page to "which columns, which
// data", not re-wiring Table+Pagination+TextFilter each time. Search value
// is debounced by the caller (useDebouncedValue) before it reaches here.
export default function ResourceTable({
  columnDefinitions,
  items,
  loading,
  header,
  page,
  pageCount,
  onPageChange,
  searchable = false,
  searchQuery = '',
  onSearchChange,
  searchPlaceholder = 'Search',
  empty,
  trackBy = 'id',
}) {
  return (
    <Table
      columnDefinitions={columnDefinitions}
      items={items}
      loading={loading}
      loadingText="Loading"
      trackBy={trackBy}
      header={header}
      empty={
        empty ?? (
          <Box textAlign="center" color="inherit">
            No items to display
          </Box>
        )
      }
      filter={
        searchable && (
          <TextFilter
            filteringText={searchQuery}
            onChange={({ detail }) => onSearchChange(detail.filteringText)}
            filteringPlaceholder={searchPlaceholder}
          />
        )
      }
      pagination={
        pageCount > 1 && (
          <Pagination
            currentPageIndex={page}
            pagesCount={pageCount}
            onChange={({ detail }) => onPageChange(detail.currentPageIndex)}
          />
        )
      }
    />
  );
}

export function tablePagesCount(total, limit) {
  return Math.max(1, Math.ceil(total / limit));
}

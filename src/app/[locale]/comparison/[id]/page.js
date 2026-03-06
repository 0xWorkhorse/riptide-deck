'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  PlusCircle,
  MinusCircle,
  ArrowUpDown,
  Download,
  Filter,
  Pencil,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import ExportDialog from '../../components/ExportDialog';

const STATUS_ICONS = {
  matched: CheckCircle,
  modified: AlertTriangle,
  added: PlusCircle,
  removed: MinusCircle,
};

export default function ComparisonResultPage() {
  const t = useTranslations('exceptions');
  const tCommon = useTranslations('common');
  const params = useParams();
  const comparisonId = params.id;

  const [comparison, setComparison] = useState(null);
  const [exceptions, setExceptions] = useState([]);
  const [counts, setCounts] = useState({ matched: 0, modified: 0, added: 0, removed: 0, total: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [sorting, setSorting] = useState([]);
  const [rowSelection, setRowSelection] = useState({});
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchExceptions = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (searchFilter) params.set('search', searchFilter);
    const res = await fetch(`/api/comparisons/${comparisonId}/exceptions?${params}`);
    const data = await res.json();
    setExceptions(data.exceptions || []);
    setCounts(data.counts || {});
  }, [comparisonId, statusFilter, searchFilter]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/comparisons?id=${comparisonId}`).then((r) => r.json()),
      fetchExceptions(),
    ]).then(([comp]) => {
      setComparison(comp);
      setLoading(false);
    });
  }, [comparisonId, fetchExceptions]);

  useEffect(() => {
    if (!loading) fetchExceptions();
  }, [statusFilter, searchFilter, fetchExceptions, loading]);

  const handleUpdateException = useCallback(async (exceptionId, updates) => {
    await fetch(`/api/comparisons/${comparisonId}/exceptions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exceptionId, updates }),
    });
    fetchExceptions();
  }, [comparisonId, fetchExceptions]);

  const handleBulkUpdate = useCallback(async (updates) => {
    const ids = Object.keys(rowSelection).map((idx) => exceptions[idx]?.id).filter(Boolean);
    if (ids.length === 0) return;
    await fetch(`/api/comparisons/${comparisonId}/exceptions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bulk: true, ids, updates }),
    });
    setRowSelection({});
    fetchExceptions();
  }, [comparisonId, rowSelection, exceptions, fetchExceptions]);

  const handleEnrichField = useCallback(async (exceptionId, currentEnriched, column, value) => {
    const enrichedValues = { ...currentEnriched, [column]: value };
    await handleUpdateException(exceptionId, { enrichedValues });
  }, [handleUpdateException]);

  const columns = useMemo(() => {
    if (exceptions.length === 0) return [];
    const dataCols = comparison?.config?.keyColumns || [];
    const allCols = exceptions[0]?.sourceA
      ? Object.keys(exceptions[0].sourceA).filter((k) => k !== '__rowIndex')
      : exceptions[0]?.sourceB
      ? Object.keys(exceptions[0].sourceB).filter((k) => k !== '__rowIndex')
      : [];

    return [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
        size: 40,
      },
      {
        accessorKey: 'status',
        header: t('summary'),
        cell: ({ getValue }) => {
          const status = getValue();
          const Icon = STATUS_ICONS[status] || AlertTriangle;
          return (
            <span className={`badge badge-${status}`}>
              <Icon className="h-3 w-3" />
              {t(`status.${status}`)}
            </span>
          );
        },
        size: 120,
      },
      ...allCols.map((col) => ({
        id: col,
        accessorFn: (row) => {
          const enriched = row.enrichedValues?.[col];
          if (enriched !== undefined && enriched !== null && enriched !== '') return enriched;
          return row.sourceA?.[col] ?? row.sourceB?.[col] ?? '';
        },
        header: () => (
          <span className={dataCols.includes(col) ? 'font-bold text-brand-400' : ''}>
            {col}
          </span>
        ),
        cell: ({ row, getValue }) => {
          const exception = row.original;
          const diff = exception.differences?.find((d) => d.column === col);
          const isEditing = editingCell?.exId === exception.id && editingCell?.col === col;
          const enriched = exception.enrichedValues?.[col];

          if (isEditing) {
            return (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleEnrichField(exception.id, exception.enrichedValues, col, editValue);
                      setEditingCell(null);
                    }
                    if (e.key === 'Escape') setEditingCell(null);
                  }}
                  className="w-full rounded border border-brand-500 bg-surface-0 px-1 py-0.5 text-xs"
                />
                <button
                  onClick={() => {
                    handleEnrichField(exception.id, exception.enrichedValues, col, editValue);
                    setEditingCell(null);
                  }}
                >
                  <Check className="h-3 w-3 text-status-matched" />
                </button>
                <button onClick={() => setEditingCell(null)}>
                  <X className="h-3 w-3 text-status-removed" />
                </button>
              </div>
            );
          }

          const val = getValue();
          return (
            <div
              className={`group flex items-center gap-1 ${diff ? 'bg-status-modified/10 rounded px-1' : ''} ${enriched ? 'ring-1 ring-brand-500/50 rounded px-1' : ''}`}
              onDoubleClick={() => {
                setEditingCell({ exId: exception.id, col });
                setEditValue(val ?? '');
              }}
            >
              <span className="truncate text-xs">{val ?? ''}</span>
              {diff && (
                <span className="shrink-0 text-[10px] text-status-modified" title={`${diff.valueA} → ${diff.valueB}`}>
                  *
                </span>
              )}
              <Pencil className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-50 cursor-pointer" />
            </div>
          );
        },
      })),
      {
        id: 'actions',
        header: tCommon('actions'),
        cell: ({ row }) => {
          const ex = row.original;
          return (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleUpdateException(ex.id, { resolution: 'accepted' })}
                className="rounded p-1 hover:bg-status-matched/20"
                title={t('actions.accept')}
              >
                <Check className="h-3.5 w-3.5 text-status-matched" />
              </button>
              <button
                onClick={() => handleUpdateException(ex.id, { resolution: 'rejected' })}
                className="rounded p-1 hover:bg-status-removed/20"
                title={t('actions.reject')}
              >
                <X className="h-3.5 w-3.5 text-status-removed" />
              </button>
            </div>
          );
        },
        size: 80,
      },
    ];
  }, [exceptions, comparison, editingCell, editValue, t, tCommon, handleEnrichField, handleUpdateException]);

  const table = useReactTable({
    data: exceptions,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
      </div>
    );
  }

  const selectedCount = Object.keys(rowSelection).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('title')}</h1>
          <p className="text-sm text-text-muted">{comparison?.name}</p>
        </div>
        <button onClick={() => setShowExport(true)} className="btn-primary flex items-center gap-2">
          <Download className="h-4 w-4" /> Export
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {['matched', 'modified', 'added', 'removed'].map((status) => {
          const Icon = STATUS_ICONS[status];
          return (
            <button
              key={status}
              onClick={() => setStatusFilter((f) => (f === status ? '' : status))}
              className={`card flex items-center gap-3 p-4 transition-colors cursor-pointer ${
                statusFilter === status ? 'ring-2 ring-brand-500' : ''
              }`}
            >
              <Icon className={`h-5 w-5 text-status-${status}`} />
              <div>
                <p className="text-xl font-bold text-text-primary">{counts[status] || 0}</p>
                <p className="text-xs text-text-muted">{t(`status.${status}`)}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters and bulk actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-border-default bg-surface-2 px-3 py-1.5">
          <Filter className="h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder={t('filters.search')}
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
          />
        </div>
        {statusFilter && (
          <button
            onClick={() => setStatusFilter('')}
            className="badge bg-brand-500/15 text-brand-400 cursor-pointer flex items-center gap-1"
          >
            {t(`status.${statusFilter}`)} <X className="h-3 w-3" />
          </button>
        )}
        {selectedCount > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-text-muted">{selectedCount} selected</span>
            <button
              onClick={() => handleBulkUpdate({ resolution: 'accepted' })}
              className="btn-ghost text-xs border border-status-matched/30 text-status-matched"
            >
              {t('actions.bulkAccept')}
            </button>
            <button
              onClick={() => handleBulkUpdate({ resolution: 'rejected' })}
              className="btn-ghost text-xs border border-status-removed/30 text-status-removed"
            >
              {t('actions.bulkReject')}
            </button>
          </div>
        )}
      </div>

      {/* Data table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-border-subtle bg-surface-2">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-text-muted"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={header.column.getCanSort() ? 'flex cursor-pointer items-center gap-1 select-none' : ''}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && <ArrowUpDown className="h-3 w-3" />}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-border-subtle hover:bg-surface-2/50 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-1.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {table.getRowModel().rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-8 text-center text-text-muted text-sm">
                    {t('noExceptions')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showExport && (
        <ExportDialog comparisonId={comparisonId} onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}

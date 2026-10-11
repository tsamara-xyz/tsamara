"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { type Asset, rate } from "@/lib/assets";
import { usd } from "@/lib/chain";
import { AssetIcon, Sparkline, StatusPill } from "./ui";

const column = createColumnHelper<Asset>();
const NUMERIC = new Set(["price", "rate", "outstanding", "chart"]);

/** The explore table. Sortable by the columns that carry a comparable value. */
export function SeriesTable(props: {
  assets: Asset[];
  decimals: number;
  outstanding: bigint;
  chart: number[];
  query: string;
}) {
  const { assets, decimals, outstanding, chart, query } = props;
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () => [
      column.display({ id: "index", header: "#", cell: ({ row }) => row.index + 1 }),
      column.accessor("symbol", {
        id: "name",
        header: "Asset Name",
        cell: ({ row }) => (
          <span className="name">
            <AssetIcon symbol={row.original.symbol} />
            <span>
              <strong>{row.original.symbol}</strong>
              <small>{row.original.name}</small>
            </span>
          </span>
        ),
      }),
      column.accessor((a) => Number(a.unitValue), {
        id: "price",
        header: "Price",
        cell: ({ row }) => usd(row.original.unitValue, decimals),
      }),
      column.accessor("profitRateBps", {
        id: "rate",
        header: "Profit rate",
        cell: ({ getValue }) => <span className="up">{rate(getValue())}</span>,
      }),
      column.accessor("maturity", { header: "Maturity" }),
      column.accessor((a) => (a.live ? Number(outstanding * a.unitValue) : -1), {
        id: "outstanding",
        header: "Outstanding",
        cell: ({ row }) => (row.original.live ? usd(outstanding * row.original.unitValue, decimals) : "—"),
      }),
      column.accessor("live", {
        id: "status",
        header: "Asset Status",
        cell: ({ getValue }) => <StatusPill live={getValue()} />,
      }),
      column.display({
        id: "chart",
        header: "Units issued",
        cell: ({ row }) => <Sparkline points={row.original.live ? chart : []} muted={!row.original.live} />,
      }),
    ],
    [decimals, outstanding, chart],
  );

  const table = useReactTable({
    data: assets,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const open = (asset: Asset) => asset.live && router.push(`/assets/${asset.symbol.toLowerCase()}`);

  return (
    <table className="table">
      <thead>
        {table.getHeaderGroups().map((group) => (
          <tr key={group.id}>
            {group.headers.map((header) => {
              const sorted = header.column.getIsSorted();
              return (
                <th
                  key={header.id}
                  className={NUMERIC.has(header.column.id) ? "num" : ""}
                  aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                >
                  {header.column.getCanSort() ? (
                    <button type="button" className="sort" onClick={header.column.getToggleSortingHandler()}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {sorted === "asc" ? " ↑" : sorted === "desc" ? " ↓" : ""}
                    </button>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr
            key={row.id}
            className={row.original.live ? "clickable" : "dim"}
            tabIndex={row.original.live ? 0 : undefined}
            onClick={() => open(row.original)}
            onKeyDown={(e) => e.key === "Enter" && open(row.original)}
          >
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} className={NUMERIC.has(cell.column.id) ? "num" : ""}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
        {assets.length === 0 && (
          <tr>
            <td colSpan={columns.length} className="muted">
              No series match “{query}”.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

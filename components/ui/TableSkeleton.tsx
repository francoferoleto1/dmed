export default function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <tbody className="animate-pulse">
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-5 py-4">
              <div className="h-3.5 rounded-full bg-gray-100" style={{ width: `${60 + (c * 11) % 35}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

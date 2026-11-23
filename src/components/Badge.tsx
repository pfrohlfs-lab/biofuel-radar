import type { Status } from '../lib/types'

const LABEL: Record<Status, string> = {
  real: 'Real data',
  example: 'Example data',
  model: 'Model',
  check: 'To verify',
}

export function Badge({ status }: { status: Status }) {
  return <span className={`badge ${status}`}>{LABEL[status]}</span>
}

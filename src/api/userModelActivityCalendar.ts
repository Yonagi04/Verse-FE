import request from './request'
import type { UserModelActivityCalendar } from '@/types/userModelActivityCalendar'

export function getUserModelActivityCalendar(view: 'ROLLING_365' | 'YEAR', year?: number, signal?: AbortSignal): Promise<UserModelActivityCalendar> {
  return request.get('/users/me/activity-calendar', { params: view === 'YEAR' ? { view, year } : { view }, signal, silentError: true })
}

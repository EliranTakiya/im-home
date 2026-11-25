import test from 'node:test'
import assert from 'node:assert/strict'
import { COMPACT_VISIT_EVENT_LIMIT, getRecentVisitEvents } from './visitJournal.js'

test('compact journal displays newest events first and respects its central limit', () => {
  const events = Array.from({ length: 8 }, (_, index) => ({ message: `event-${index + 1}` }))
  assert.equal(COMPACT_VISIT_EVENT_LIMIT, 5)
  assert.deepEqual(getRecentVisitEvents(events).map((event) => event.message), ['event-8', 'event-7', 'event-6', 'event-5', 'event-4'])
})

test('compact journal leaves the original complete history untouched', () => {
  const events = Array.from({ length: 7 }, (_, index) => ({ message: `event-${index + 1}` }))
  const original = [...events]
  getRecentVisitEvents(events)
  assert.deepEqual(events, original)
  assert.equal(events.length, 7)
})

test('compact journal safely handles empty history and invalid limits', () => {
  assert.deepEqual(getRecentVisitEvents([]), [])
  assert.deepEqual(getRecentVisitEvents([{ message: 'event' }], 0), [])
  assert.deepEqual(getRecentVisitEvents(null), [])
})

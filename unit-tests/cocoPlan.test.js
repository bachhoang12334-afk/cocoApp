import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCocoPlanInsert,
  getDefaultCocoPlanStartAt,
  getCocoPlanActions,
  getCocoPlanDraftErrors,
  isCocoPlanExpired,
  mapCocoPlan,
  mergeCocoPlans,
  normalizeCocoPlanDraft,
} from '../src/lib/cocoPlan.js'

const fixedNow = new Date('2026-09-30T08:00:00.000Z')

test('maps only the public Coco Plan shape and identifies the proposer', () => {
  const plan = mapCocoPlan({
    id: 'plan-1',
    connection_request_id: 'connection-1',
    proposer_id: 'user-a',
    title: 'Ôn React',
    starts_at: '2026-10-01T09:30:00.000Z',
    mode: 'campus',
    location_note: null,
    status: 'proposed',
    created_at: '2026-09-30T09:00:00.000Z',
    updated_at: '2026-09-30T09:00:00.000Z',
    private_note: 'must not leak',
  }, 'user-a')

  assert.deepEqual(plan, {
    id: 'plan-1',
    connectionRequestId: 'connection-1',
    proposerId: 'user-a',
    title: 'Ôn React',
    startsAt: '2026-10-01T09:30:00.000Z',
    mode: 'campus',
    locationNote: '',
    status: 'proposed',
    createdAt: '2026-09-30T09:00:00.000Z',
    updatedAt: '2026-09-30T09:00:00.000Z',
    isMine: true,
  })

  assert.equal(mapCocoPlan({
    id: 'plan-1',
    connection_request_id: 'connection-1',
    proposer_id: 'user-a',
  }, 'user-b').isMine, false)
})

test('normalizes a draft and builds an allowlisted insert payload', () => {
  const draft = {
    title: '  Ôn   React cùng nhau  ',
    startsAt: '2026-10-01T09:30:00.000Z',
    mode: 'online',
    locationNote: '  Google   Meet  ',
  }

  assert.deepEqual(normalizeCocoPlanDraft(draft), {
    title: 'Ôn React cùng nhau',
    startsAt: '2026-10-01T09:30:00.000Z',
    mode: 'online',
    locationNote: 'Google Meet',
  })

  assert.deepEqual(buildCocoPlanInsert(draft, {
    connectionRequestId: 'connection-1',
    proposerId: 'user-a',
  }), {
    connection_request_id: 'connection-1',
    proposer_id: 'user-a',
    title: 'Ôn React cùng nhau',
    starts_at: '2026-10-01T09:30:00.000Z',
    mode: 'online',
    location_note: 'Google Meet',
  })

  const localInput = '2026-10-01T09:30'
  assert.equal(
    normalizeCocoPlanDraft({ ...draft, startsAt: localInput }).startsAt,
    new Date(localInput).toISOString()
  )
  assert.equal(
    new Date(getDefaultCocoPlanStartAt(fixedNow)).getTime() - fixedNow.getTime(),
    2 * 60 * 60 * 1000
  )
})

test('validates title, mode, future time, and privacy-safe location length', () => {
  const validDraft = {
    title: 'Ôn React',
    startsAt: '2026-10-01T09:30:00.000Z',
    mode: 'campus',
    locationNote: 'Thư viện khu A',
  }

  assert.deepEqual(getCocoPlanDraftErrors(validDraft, { now: fixedNow }), {})
  assert.deepEqual(getCocoPlanDraftErrors({
    ...validDraft,
    title: 'x'.repeat(4),
    locationNote: 'x'.repeat(160),
  }, { now: fixedNow }), {})
  assert.deepEqual(getCocoPlanDraftErrors({
    ...validDraft,
    title: 'x'.repeat(120),
  }, { now: fixedNow }), {})
  assert.ok(getCocoPlanDraftErrors({ ...validDraft, title: 'abc' }, { now: fixedNow }).title)
  assert.ok(getCocoPlanDraftErrors({ ...validDraft, title: 'x'.repeat(121) }, { now: fixedNow }).title)
  assert.ok(getCocoPlanDraftErrors({ ...validDraft, mode: 'home' }, { now: fixedNow }).mode)
  assert.ok(getCocoPlanDraftErrors({ ...validDraft, startsAt: 'not-a-date' }, { now: fixedNow }).startsAt)
  assert.ok(getCocoPlanDraftErrors({ ...validDraft, startsAt: '2026-09-29T09:30:00.000Z' }, { now: fixedNow }).startsAt)
  assert.ok(getCocoPlanDraftErrors({ ...validDraft, startsAt: fixedNow.toISOString() }, { now: fixedNow }).startsAt)
  assert.ok(getCocoPlanDraftErrors({ ...validDraft, locationNote: 'x'.repeat(161) }, { now: fixedNow }).locationNote)
})

test('returns only status transitions available to the current participant', () => {
  assert.deepEqual(getCocoPlanActions({ status: 'proposed', isMine: true }), ['cancelled'])
  assert.deepEqual(getCocoPlanActions({ status: 'proposed', isMine: false }), ['accepted', 'declined'])
  assert.deepEqual(getCocoPlanActions({ status: 'accepted', isMine: true }), ['completed', 'cancelled'])
  assert.deepEqual(getCocoPlanActions({ status: 'accepted', isMine: false }), ['completed', 'cancelled'])

  for (const status of ['declined', 'cancelled', 'completed', 'unknown']) {
    assert.deepEqual(getCocoPlanActions({ status, isMine: false }), [])
  }
})

test('marks past proposals as expired and never offers an impossible acceptance', () => {
  const pastProposal = {
    status: 'proposed',
    startsAt: '2026-09-30T07:59:59.000Z',
  }

  assert.equal(isCocoPlanExpired(pastProposal, fixedNow), true)
  assert.equal(isCocoPlanExpired({
    ...pastProposal,
    startsAt: '2026-09-30T08:00:01.000Z',
  }, fixedNow), false)
  assert.deepEqual(
    getCocoPlanActions({ ...pastProposal, isMine: false }, { now: fixedNow }),
    ['declined']
  )
  assert.deepEqual(
    getCocoPlanActions({ ...pastProposal, isMine: true }, { now: fixedNow }),
    ['cancelled']
  )
})

test('keeps a newer confirmed plan transition when an older refresh resolves later', () => {
  const stalePlan = {
    id: 'plan-1',
    status: 'proposed',
    createdAt: '2026-09-30T09:00:00.000Z',
    updatedAt: '2026-09-30T09:00:00.000Z',
  }
  const acceptedPlan = {
    ...stalePlan,
    status: 'accepted',
    updatedAt: '2026-09-30T09:05:00.000Z',
  }

  assert.equal(mergeCocoPlans(stalePlan, acceptedPlan), acceptedPlan)
  assert.equal(mergeCocoPlans(acceptedPlan, stalePlan), acceptedPlan)
  assert.equal(mergeCocoPlans(null, acceptedPlan), acceptedPlan)
})

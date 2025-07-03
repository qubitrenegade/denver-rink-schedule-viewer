import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useEventData } from './useEventData';

global.fetch = vi.fn((input: RequestInfo) => {
  const url = typeof input === 'string' ? input : input.url;
  
  // Handle bulk API endpoints (new behavior)
  if (url.endsWith('/api/all-events')) {
    return Promise.resolve(new Response(
      JSON.stringify([{ id: '1', rinkId: 'ice-ranch', title: 'Test Event', startTime: '2025-06-01T10:00:00Z', endTime: '2025-06-01T11:00:00Z', category: 'Public Skate' }]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ));
  }
  if (url.endsWith('/api/all-metadata')) {
    return Promise.resolve(new Response(
      JSON.stringify({
        'ice-ranch': {
          facilityId: 'ice-ranch',
          facilityName: 'Ice Ranch',
          displayName: 'Ice Ranch',
          lastAttempt: new Date().toISOString(),
          status: 'success',
          eventCount: 1,
          sourceUrl: '',
          rinks: [{ rinkId: 'ice-ranch', rinkName: 'Main Rink' }],
          lastSuccessfulScrape: new Date().toISOString()
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ));
  }
  
  // Handle individual facility endpoints (fallback behavior)
  if (url.endsWith('.json') && !url.includes('-metadata')) {
    return Promise.resolve(new Response(
      JSON.stringify([{ id: '1', rinkId: 'ice-ranch', title: 'Test Event', startTime: '2025-06-01T10:00:00Z', endTime: '2025-06-01T11:00:00Z', category: 'Public Skate' }]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ));
  }
  if (url.endsWith('-metadata.json')) {
    return Promise.resolve(new Response(
      JSON.stringify({
        facilityId: 'ice-ranch',
        facilityName: 'Ice Ranch',
        displayName: 'Ice Ranch',
        lastAttempt: new Date().toISOString(),
        status: 'success',
        eventCount: 1,
        sourceUrl: '',
        rinks: [{ rinkId: 'ice-ranch', rinkName: 'Main Rink' }],
        lastSuccessfulScrape: new Date().toISOString()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ));
  }
  
  // Default fallback
  return Promise.resolve(new Response(
    JSON.stringify([]),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  ));
});

describe('useEventData', () => {
  it('returns event data and loading state', async () => {
    const { result } = renderHook(() => useEventData());
    // Trigger the fetch
    result.current.refetch();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.staticData.length).toBeGreaterThan(0);
    expect(result.current.staticData[0].rinkId).toBe('ice-ranch');
  });
});

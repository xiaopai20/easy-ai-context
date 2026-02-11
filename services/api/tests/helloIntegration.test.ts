import test from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest } from './helpers';

test('integration: GET /hello returns Hello World', async () => {
  const body = await apiRequest<{ message: string }>('/hello');
  assert.equal(body.message, 'Hello World');
});

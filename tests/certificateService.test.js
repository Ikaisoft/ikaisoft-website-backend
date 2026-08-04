import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVerificationUrl, buildCertificateNumberFromSequence } from '../services/certificateService.js';

test('buildVerificationUrl returns the public verification URL', () => {
  assert.equal(buildVerificationUrl('IKA-2026-000001'), 'https://www.ikaisoft.com/verify/IKA-2026-000001');
});

test('buildCertificateNumberFromSequence pads the sequence correctly', () => {
  assert.equal(buildCertificateNumberFromSequence(5, 2026), 'IKA-2026-000005');
  assert.equal(buildCertificateNumberFromSequence(12, 2026), 'IKA-2026-000012');
});

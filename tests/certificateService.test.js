import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVerificationUrl, buildCertificateNumberFromSequence } from '../services/certificateService.js';

test('buildVerificationUrl returns the public generic verification URL', () => {
  assert.equal(buildVerificationUrl(), 'https://ikaisoft.com/certificate');
  assert.equal(buildVerificationUrl('ICS-2026-000001'), 'https://ikaisoft.com/certificate');
});

test('buildCertificateNumberFromSequence pads the sequence correctly', () => {
  assert.equal(buildCertificateNumberFromSequence(5, 2026), 'ICS-2026-000005');
  assert.equal(buildCertificateNumberFromSequence(12, 2026), 'ICS-2026-000012');
});

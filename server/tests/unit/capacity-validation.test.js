import { describe, test, expect } from 'vitest';
import { validateMealSlot, validateDiningTable } from '../../services/capacity-validation.js';

describe('Capacity Validation Unit Tests', () => {


    describe('validateMealSlot', () => {
    test('should pass with valid meal slot data', () => {
      const validSlot = {
        id: 1,
        mealType: 'dinner',
        date: '2026-11-01',
        maxCapacity: 50,
        active: true
      };
      const result = validateMealSlot(validSlot);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should fail when meal type/name is missing or empty', () => {
      const invalidSlot = {
        id: 1,
        mealType: '',
        date: '2026-11-01',
        maxCapacity: 50
      };
      const result = validateMealSlot(invalidSlot);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Meal slot name/type is required and must be a non-empty string.');
    });

    test('should fail when date/time is invalid', () => {
      const invalidSlot = {
        id: 1,
        mealType: 'lunch',
        date: 'not-a-valid-date',
        maxCapacity: 30
      };
      const result = validateMealSlot(invalidSlot);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Meal slot date/time must be a valid date string.');
    });

    test('should fail when max capacity is zero or negative', () => {
      const invalidSlot = {
        id: 1,
        mealType: 'lunch',
        date: '2026-11-01',
        maxCapacity: -5
      };
      const result = validateMealSlot(invalidSlot);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Max capacity must be a positive number.');
    });

    test('should fail when assignment ID is invalid (non-positive)', () => {
      const invalidSlot = {
        id: -1,
        mealType: 'dinner',
        date: '2026-11-01',
        maxCapacity: 20
      };
      const result = validateMealSlot(invalidSlot);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Meal slot ID must be a positive number.');
    });
  });



  describe('validateDiningTable', () => {
    test('should pass with valid dining table data', () => {
      const validTable = {
        id: 1,
        tableNumber: 4,
        seatCount: 6,
        active: 1
      };
      const result = validateDiningTable(validTable);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should fail when seat count is zero or negative', () => {
      const invalidTable = {
        id: 1,
        tableNumber: 2,
        seatCount: 0,
        active: true
      };
      const result = validateDiningTable(invalidTable);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Seat count must be a positive integer greater than zero.');
    });

    test('should fail when active status has an invalid value format', () => {
      const invalidTable = {
        id: 1,
        tableNumber: 3,
        seatCount: 4,
        active: 'maybe'
      };
      const result = validateDiningTable(invalidTable);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Active status must be a boolean or 0/1.');
    });

    test('should fail when assignment/table ID is invalid', () => {
      const invalidTable = {
        id: 0,
        tableNumber: 1,
        seatCount: 4
      };
      const result = validateDiningTable(invalidTable);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Table ID must be a positive number.');
    });
  });
});
import { getDistance, formatDistance } from '../../lib/utils';

describe('Location Utils (Level 1 Unit Tests)', () => {
  
  describe('getDistance (Haversine)', () => {
    const uetMardan = { lat: 34.1983, lon: 72.0433 };
    const sportsComplex = { lat: 34.2005, lon: 72.0469 };
    const kabul = { lat: 34.5553, lon: 69.2075 };

    test('calculates correct distance between two nearby points in Mardan', () => {
      const distance = getDistance(uetMardan.lat, uetMardan.lon, sportsComplex.lat, sportsComplex.lon);
      
      // Approximately 415 meters (0.415 km)
      expect(distance).toBeGreaterThan(0.3);
      expect(distance).toBeLessThan(0.5);
    });

    test('calculates correct distance for international range (Mardan to Kabul)', () => {
      const distance = getDistance(uetMardan.lat, uetMardan.lon, kabul.lat, kabul.lon);
      
      // Approximately 265 km
      expect(distance).toBeGreaterThan(250);
      expect(distance).toBeLessThan(280);
    });

    test('returns 0 for the same point', () => {
      const distance = getDistance(uetMardan.lat, uetMardan.lon, uetMardan.lat, uetMardan.lon);
      expect(distance).toBe(0);
    });
  });

  describe('formatDistance', () => {
    test('formats meters correctly for sub-1km distances', () => {
      expect(formatDistance(0.415)).toBe('415 m away');
      expect(formatDistance(0.05)).toBe('50 m away');
    });

    test('formats kilometers correctly for large distances', () => {
      expect(formatDistance(1.234)).toBe('1.2 km away');
      expect(formatDistance(265.88)).toBe('265.9 km away');
    });

    test('handles exactly 1km boundary', () => {
      expect(formatDistance(1.0)).toBe('1.0 km away');
    });
  });

});

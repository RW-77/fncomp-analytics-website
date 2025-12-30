export interface StatFilters {
  selectedMatches: string[],
  weaponTypes: string[],
  timeRange: [number, number],
  distanceRange: [number, number],
} 

/**
 * Filter capabilities for different stat types.
 * Each stat type can specify which filters it supports.
 */
export interface FilterCapabilities {
  supportsMatches: boolean;
  supportsWeaponTypes: boolean;
  supportsTimeRange: boolean;
  supportsDistanceRange: boolean;
} 

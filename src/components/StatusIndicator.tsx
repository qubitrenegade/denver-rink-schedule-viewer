import React from 'react';
import { FacilityMetadata } from '../types';
import { LoadingIcon } from './icons';

interface StatusIndicatorProps {
  isLoading: boolean;
  error: string | null;
  facilityMetadata: Record<string, FacilityMetadata>;
  facilityErrors: Record<string, string>;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  isLoading,
  error,
  facilityMetadata,
  facilityErrors
}) => {
  const hasErrors = error || Object.keys(facilityErrors).length > 0;
  const hasMetadata = Object.keys(facilityMetadata).length > 0;

  if (isLoading && !hasMetadata) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center">
          <LoadingIcon className="animate-spin h-5 w-5 mr-3 text-blue-600" />
          <div>
            <p className="text-blue-800 font-medium">Loading schedule data...</p>
            <p className="text-blue-600 text-sm">Please wait while we fetch the latest information</p>
          </div>
        </div>
      </div>
    );
  }

  if (hasErrors && !hasMetadata) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div>
          <p className="text-red-800 font-medium">Unable to load schedule data</p>
          {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
          {Object.entries(facilityErrors).map(([facilityId, errorMsg]) => (
            <p key={facilityId} className="text-red-600 text-sm mt-1">
              {facilityId}: {errorMsg}
            </p>
          ))}
        </div>
      </div>
    );
  }

  if (hasMetadata) {
    const lastUpdated = (Object.values(facilityMetadata) as FacilityMetadata[])
      .filter(meta => meta?.lastSuccessfulScrape)
      .map(meta => new Date(meta.lastSuccessfulScrape!))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-green-800 font-medium">Schedule data loaded successfully</p>
            {lastUpdated && (
              <p className="text-green-600 text-sm">
                Last updated: {lastUpdated.toLocaleString()}
              </p>
            )}
          </div>
          {isLoading && (
            <LoadingIcon className="animate-spin h-4 w-4 text-green-600" />
          )}
        </div>
        {hasErrors && (
          <div className="mt-3 pt-3 border-t border-green-200">
            <p className="text-amber-700 text-sm font-medium">Some facilities had issues:</p>
            {Object.entries(facilityErrors).map(([facilityId, errorMsg]) => (
              <p key={facilityId} className="text-amber-600 text-sm">
                {facilityId}: {errorMsg}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default StatusIndicator;
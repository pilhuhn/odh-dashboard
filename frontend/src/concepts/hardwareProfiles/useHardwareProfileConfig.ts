import React, { useRef } from 'react';
import { HardwareProfileKind, HardwareProfileFeatureVisibility } from '~/k8sTypes';
import { UpdateObjectAtPropAndValue } from '~/pages/projects/types';
import useGenericObjectState from '~/utilities/useGenericObjectState';
import { ContainerResources, NodeSelector, Toleration } from '~/types';
import { isCpuLimitLarger, isMemoryLimitLarger } from '~/utilities/valueUnits';
import { SupportedArea, useIsAreaAvailable } from '~/concepts/areas';
import { useHardwareProfilesByFeatureVisibility } from '~/pages/hardwareProfiles/migration/useHardwareProfilesByFeatureVisibility';
import { isHardwareProfileConfigValid } from './validationUtils';
import { getContainerResourcesFromHardwareProfile } from './utils';

export type HardwareProfileConfig = {
  selectedProfile?: HardwareProfileKind;
  useExistingSettings: boolean;
  resources?: ContainerResources;
};

export type UseHardwareProfileConfigResult = {
  formData: HardwareProfileConfig;
  initialHardwareProfile?: HardwareProfileKind;
  isFormDataValid: boolean;
  setFormData: UpdateObjectAtPropAndValue<HardwareProfileConfig>;
  resetFormData: () => void;
  profilesLoaded: boolean;
  profilesLoadError?: Error;
};

const matchToHardwareProfile = (
  hardwareProfiles: HardwareProfileKind[],
  resources?: ContainerResources,
  tolerations: Toleration[] = [],
  nodeSelector: NodeSelector = {},
): HardwareProfileKind | undefined => {
  if (!resources) {
    return undefined;
  }

  const matchingProfiles = hardwareProfiles.filter((profile) => {
    const identifiersMatch = profile.spec.identifiers?.every((identifier) => {
      const requestValue = resources.requests?.[identifier.identifier];
      const limitValue = resources.limits?.[identifier.identifier];

      if (!requestValue || !limitValue) {
        return false;
      }

      if (identifier.identifier === 'cpu') {
        return (
          // max is larger or equal
          isCpuLimitLarger(requestValue, identifier.maxCount, true) &&
          isCpuLimitLarger(limitValue, identifier.maxCount, true) &&
          // min is smaller or equal
          isCpuLimitLarger(identifier.minCount, requestValue, true) &&
          isCpuLimitLarger(identifier.minCount, limitValue, true)
        );
      }

      if (identifier.identifier === 'memory') {
        return (
          // max is larger or equal
          (!identifier.maxCount ||
            (isMemoryLimitLarger(requestValue.toString(), identifier.maxCount.toString(), true) &&
              isMemoryLimitLarger(limitValue.toString(), identifier.maxCount.toString(), true))) &&
          // min is smaller or equal
          isMemoryLimitLarger(identifier.minCount.toString(), requestValue.toString(), true) &&
          isMemoryLimitLarger(identifier.minCount.toString(), limitValue.toString(), true)
        );
      }

      return (
        // min is smaller or equal
        Number(identifier.minCount) <= Number(requestValue) &&
        Number(identifier.minCount) <= Number(limitValue) &&
        // max is larger or equal
        Number(identifier.maxCount) >= Number(requestValue) &&
        Number(identifier.maxCount) >= Number(limitValue)
      );
    });

    const tolerationsMatch = profile.spec.tolerations?.every((toleration) =>
      tolerations.some(
        (t) =>
          t.key === toleration.key &&
          t.value === toleration.value &&
          t.operator === toleration.operator &&
          t.effect === toleration.effect &&
          t.tolerationSeconds === toleration.tolerationSeconds,
      ),
    );

    const nodeSelectorMatch = Object.entries(profile.spec.nodeSelector || {}).every(
      ([key, value]) => nodeSelector[key] === value,
    );

    return identifiersMatch && tolerationsMatch && nodeSelectorMatch;
  });

  return matchingProfiles.length > 0 ? matchingProfiles[0] : undefined;
};

export const useHardwareProfileConfig = (
  existingHardwareProfileName?: string,
  resources?: ContainerResources,
  tolerations?: Toleration[],
  nodeSelector?: NodeSelector,
  visibleIn?: HardwareProfileFeatureVisibility[],
): UseHardwareProfileConfigResult => {
  const [profiles, profilesLoaded, profilesLoadError] =
    useHardwareProfilesByFeatureVisibility(visibleIn);
  const initialHardwareProfile = useRef<HardwareProfileKind | undefined>(undefined);
  const [formData, setFormData, resetFormData] = useGenericObjectState<HardwareProfileConfig>({
    selectedProfile: undefined,
    useExistingSettings: false,
  });

  const hardwareProfilesAvailable = useIsAreaAvailable(SupportedArea.HARDWARE_PROFILES).status;
  const isFormDataValid = React.useMemo(
    () => (hardwareProfilesAvailable ? isHardwareProfileConfigValid(formData) : true),
    [formData, hardwareProfilesAvailable],
  );

  React.useEffect(() => {
    if (!profilesLoaded || formData.selectedProfile) {
      return;
    }
    // only set form state if not already set
    if (!formData.resources) {
      let selectedProfile: HardwareProfileKind | undefined;

      // if editing, try to select existing profile
      if (resources) {
        // try to match to existing profile
        if (existingHardwareProfileName) {
          selectedProfile = profiles.find(
            (profile) => profile.metadata.name === existingHardwareProfileName,
          );
        } else {
          selectedProfile = matchToHardwareProfile(profiles, resources, tolerations, nodeSelector);
        }

        initialHardwareProfile.current = selectedProfile;
        setFormData('resources', resources);
        setFormData('useExistingSettings', !selectedProfile);
        setFormData('selectedProfile', selectedProfile);
      }

      // if not editing existing profile, select the first enabled profile
      else {
        selectedProfile = profiles.find((profile) => profile.spec.enabled);
        if (selectedProfile) {
          setFormData('resources', getContainerResourcesFromHardwareProfile(selectedProfile));
          setFormData('selectedProfile', selectedProfile);
        }
      }
    }
  }, [
    existingHardwareProfileName,
    profiles,
    profilesLoaded,
    setFormData,
    resources,
    tolerations,
    nodeSelector,
    formData.resources,
    formData.selectedProfile,
  ]);

  return {
    formData,
    initialHardwareProfile: initialHardwareProfile.current,
    isFormDataValid,
    setFormData,
    resetFormData,
    profilesLoaded,
    profilesLoadError,
  };
};

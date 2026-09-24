import { useRef, useState } from "react";
import * as ridesApi from "../services/api/rides";

type Params = {
  shouldSkip: () => boolean;
  onRideFound: (ride: any, status: string) => void;
  waitBeforeShow?: () => Promise<void>;
};

export const useRideRestore = ({ shouldSkip, onRideFound, waitBeforeShow }: Params) => {
  const [showRestoreModal, setShowRestoreModalState] = useState(false);
  const showRestoreModalRef = useRef(false);
  const setShowRestoreModal = (val: boolean) => {
    showRestoreModalRef.current = val;
    setShowRestoreModalState(val);
  };
  const [restoreRideData, setRestoreRideData] = useState<any>(null);

  const shouldSkipRef = useRef(shouldSkip);
  shouldSkipRef.current = shouldSkip;
  const onRideFoundRef = useRef(onRideFound);
  onRideFoundRef.current = onRideFound;
  const waitBeforeShowRef = useRef(waitBeforeShow);
  waitBeforeShowRef.current = waitBeforeShow;

  const checkForActiveRide = async () => {
    if (shouldSkipRef.current()) {
      return;
    }
    if (showRestoreModalRef.current) {
      return;
    }
    try {
      const response = await ridesApi.getCurrentRide();
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      if (!data.Data) {
        return;
      }
      const ride = data.Data;
      const status = ride.status;
      if (status !== "accepted_by_driver" && status !== "in_progress") {
        return;
      }
      setRestoreRideData(ride);
      onRideFoundRef.current(ride, status);
      if (waitBeforeShowRef.current) {
        await waitBeforeShowRef.current();
      }
      if (shouldSkipRef.current() || showRestoreModalRef.current) {
        return;
      }
      setShowRestoreModal(true);
    } catch {
      // silently ignore
    }
  };

  return {
    showRestoreModal,
    setShowRestoreModal,
    showRestoreModalRef,
    restoreRideData,
    setRestoreRideData,
    checkForActiveRide,
  };
};

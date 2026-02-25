import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { LOCATION_TASK_NAME } from "./locationService";
import { useDeliveryStore } from "../../store/deliveryStore";

TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
  if (error) {
    return;
  }
  const locationData = data as { locations?: Location.LocationObject[] } | undefined;
  const locations = locationData?.locations;
  if (!locations || locations.length === 0) {
    return;
  }

  const first = locations[0];
  if (!first?.coords) {
    return;
  }

  const { latitude, longitude, heading } = first.coords;
  if (latitude == null || longitude == null) {
    return;
  }

  useDeliveryStore.getState().setCurrentLocation({
    latitude,
    longitude,
    heading: typeof heading === "number" && !Number.isNaN(heading) ? heading : undefined,
  });
});


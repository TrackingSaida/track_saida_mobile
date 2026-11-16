import * as TaskManager from "expo-task-manager";
import { LOCATION_TASK_NAME } from "./locationService";
import { applyBackgroundLocationUpdate } from "./applyBackgroundLocationUpdate";
import { useDeliveryStore } from "../../store/deliveryStore";

TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
  applyBackgroundLocationUpdate(data, error, (location) => {
    useDeliveryStore.getState().setCurrentLocation(location);
  });
});

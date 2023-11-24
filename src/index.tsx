import React from "react";
import mixpanel from "mixpanel-browser";
import ReactDOM from "react-dom";

mixpanel.init("063e9838740260bebb040a86ddca9f83");

import { WorkoutRoom as LegacyWorkoutRoom } from "./legacy/Store";
import { WorkoutRoom } from "./WorkoutStore";
import LegacyApp from "./legacy/App";
import App from "./views/App";

const url = new URLSearchParams(window.location.search);
const jwt = url.get("w") ?? "";
const v = url.get("v") ?? "";

const store = v === "2" ? new WorkoutRoom() : new LegacyWorkoutRoom();
const View: any = v === "2" ? App : LegacyApp;

ReactDOM.render(<View store={store} jwt={jwt} />, document.getElementById("root"));

import React, { useState } from "react";
import ReactDOM from "react-dom";
import { WorkoutRoom } from "./workout";
import { PoseCamera } from "./PoseCamera";

const App = () => {
  const [store] = useState(() => new WorkoutRoom());

  return (
    <div>
      <PoseCamera onFrame={store.processFrame} />
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById("root"));

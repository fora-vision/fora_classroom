import React, { useEffect, useState } from "react";
import * as S from "./styled";

const ExerciseHint = ({ frames, per }) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setFrame((f) => (f + 1) % frames.length), per);
    return () => clearInterval(timer);
  }, []);

  return (
    <S.ExerciseHint>
      <img src={frames[frame]} />
    </S.ExerciseHint>
  );
};

export default ExerciseHint;

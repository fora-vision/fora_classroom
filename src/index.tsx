import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { WorkoutRoom, WorkoutState } from "./WorkoutStore";
import { PoseCamera } from "./PoseCamera";
import { observer } from "mobx-react-lite";
import * as S from "./styled";

const formatTime = (time: number) => {
  const mm = Math.floor(time / 60)
  const fm = mm < 10 ? '0' + mm : mm;
  const ss = time % 60
  const fs = ss < 10 ? '0' + ss : ss;
  return `${fm}:${fs}`
}

const store = new WorkoutRoom();
const jwt = new URLSearchParams(window.location.search).get("w");
if (jwt) void store?.initialize(jwt);

const App = observer(() => {
  console.log(store.getExercise())

  return (
    <div>
      <PoseCamera
        highlightSkelet={store.highlightSkelet}
        onFrame={store.processFrame}
      />
      
      {store.exercise && (
        <S.Overlay>
          <S.ExerciseWidget>
            <S.ExerciseTitle>{store.getExercise()?.name}</S.ExerciseTitle>
            <S.ExerciseCount>{store.exercise?.count}</S.ExerciseCount>
          </S.ExerciseWidget>
          <S.Timeline>
            <S.TimelineProgress style={{ width: `${store.progress * 100}%` }} />
            <S.TimelineTotal>{formatTime(store.totalTime)}</S.TimelineTotal>
          </S.Timeline>
        </S.Overlay>
      )}

      {store.state === WorkoutState.Hint && (
        <S.HintOverlay>
          <S.HintImage src={store.getExercise()?.image_down.replace('.png', '')} />
          <S.HintImage src={store.getExercise()?.image_up.replace('.png', '')} />
        </S.HintOverlay>
      )}

      {store.state === WorkoutState.Complete && (
        <S.HintOverlay style={{ flexDirection: 'column' }}>
          <h1 style={{ color: '#fff' }}>Тренировка завершена!</h1>
          <p style={{ color: '#fff' }}>Можете закрыть страницу, ваш результат сохранен</p>
        </S.HintOverlay>
      )}

      {store.state === WorkoutState.Error && (
        <S.HintOverlay style={{ flexDirection: 'column' }}>
          <h1 style={{ color: '#fff' }}>Произошла ошибка!</h1>
          <p style={{ color: '#fff' }}>
            У вас есть три минуты чтобы перезагрузить страницу и возобновить тренировку
          </p>
        </S.HintOverlay>
      )}

      {store.state === WorkoutState.Loading && (
        <S.HintOverlay>
          <h1 style={{ color: '#fff' }}>Загрузка...</h1>
        </S.HintOverlay>
      )}
    </div>
  );
});

ReactDOM.render(<App />, document.getElementById("root"));

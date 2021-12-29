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
const jwt = new URLSearchParams(window.location.search).get("w") ?? ""
void store?.initialize(jwt);

const App = observer(() => {
  const [isVideo, setVideo] = useState(false)

  return (
    <div>
      <PoseCamera
        highlightSkelet={store.highlightSkelet}
        onFrame={store.processFrame}
      />
      
      {!isVideo && store.exercise && (
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

      {(!isVideo && store.state === WorkoutState.Hint) && (
        <S.HintOverlay>
          <S.HintImage src={store.getExercise()?.image_down.replace('.png', '')} />
          <S.HintImage src={store.getExercise()?.image_up.replace('.png', '')} />
        </S.HintOverlay>
      )}

      {!isVideo && store.exercise && (
        <S.HintButton onClick={() => setVideo(true)}>Показать упражнение</S.HintButton>
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

      {store.state === WorkoutState.InitializeFailed && (
        <S.HintOverlay style={{ flexDirection: 'column' }}>
          <h1 style={{ color: '#fff' }}>Не получилось запустить тренировку</h1>
          <p style={{ color: '#fff' }}>
            Вероятно на данный момент все воркеры заняты, попробуйте позже
          </p>
        </S.HintOverlay>
      )}

      {store.state === WorkoutState.Loading && (
        <S.HintOverlay>
          <h1 style={{ color: '#fff' }}>Загрузка...</h1>
        </S.HintOverlay>
      )}

      {isVideo && (
        <S.HintOverlay onClick={() => setVideo(false)}>
          <video
            controls
            onClick={(e) => e.stopPropagation()}
            style={{ borderRadius: 16, background: 'rgba(0, 0, 0, .2)', width: '70%' }}
            src={store.getExercise()?.video_url}
          />
          <S.HintButton
            style={{ top: 64, bottom: 'auto', right: 64 }}
            onClick={() => setVideo(false)}>
            Закрыть
          </S.HintButton>
        </S.HintOverlay>
      )}
    </div>
  );
});

ReactDOM.render(<App />, document.getElementById("root"));

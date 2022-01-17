import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import QRCode from "react-qr-code";

import { WorkoutRoom, WorkoutState } from "./WorkoutStore";
import { PoseCamera } from "./PoseCamera";
import { observer } from "mobx-react-lite";
import * as S from "./styled";

const formatTime = (time: number) => {
  const mm = Math.floor(time / 60);
  const fm = mm < 10 ? "0" + mm : mm;
  const ss = time % 60;
  const fs = ss < 10 ? "0" + ss : ss;
  return `${fm}:${fs}`;
};

const store = new WorkoutRoom();
const jwt = new URLSearchParams(window.location.search).get("w") ?? "";
if (jwt === "") store?.generateInvite();
else void store?.initialize(jwt);

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

const App = observer(() => {
  const [isVideo, setVideo] = useState(false);
  return (
    <div>
      <PoseCamera
        style={{ opacity: store.state === WorkoutState.Invite ? 0 : 1 }}
        highlightSkelet={store.highlightSkelet}
        onFrame={store.processFrame}
      />

      {!isVideo && store.exercise && (
        <S.Page>
          <S.Screen>
            <S.ExerciseTitle>{store.getExercise()?.name}</S.ExerciseTitle>
            <S.ExerciseCount>{store.exercise?.count}</S.ExerciseCount>

            <S.HelpSide>
              {store.state === WorkoutState.Hint && (
                <ExerciseHint
                  per={2000}
                  frames={[
                    store.getExercise()?.image_down.replace(".png", ""),
                    store.getExercise()?.image_up.replace(".png", ""),
                  ]}
                />
              )}

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <S.HintButton onClick={() => setVideo(true)}>
                  Показать упражнение
                </S.HintButton>
                <S.HintButton style={{ marginLeft: 16 }}>Помощь</S.HintButton>
              </div>
            </S.HelpSide>
          </S.Screen>
          <S.Timeline>
            <S.TimelineProgress style={{ width: `${store.progress * 100}%` }} />
            <S.TimelineTotal>{formatTime(store.totalTime)}</S.TimelineTotal>
          </S.Timeline>
        </S.Page>
      )}

      {store.state === WorkoutState.Invite && (
        <S.Overlay>
          <div style={{ width: 400, marginRight: 64 }}>
            <h1 style={{ color: "#fff" }}>Добро пожаловать!</h1>
            <p style={{ color: "#fff" }}>
              Откройте приложение Fora.Vision на IOS и отсканируйте этот QR код, чтобы начать тренировку прямо в браузере
            </p>
          </div>

          <QRCode  value={store.inviteCode} />
        </S.Overlay>
      )}

      {store.state === WorkoutState.Complete && (
        <S.Overlay style={{ flexDirection: "column" }}>
          <h1 style={{ color: "#fff" }}>Тренировка завершена!</h1>
          <p style={{ color: "#fff" }}>
            Можете закрыть страницу, ваш результат сохранен
          </p>
        </S.Overlay>
      )}

      {store.state === WorkoutState.Error && (
        <S.Overlay style={{ flexDirection: "column" }}>
          <h1 style={{ color: "#fff" }}>{store.error.title}</h1>
          <p style={{ color: "#fff" }}>{store.error.description}</p>
        </S.Overlay>
      )}

      {store.state === WorkoutState.Loading && (
        <S.Overlay>
          <h1 style={{ color: "#fff" }}>Загрузка...</h1>
        </S.Overlay>
      )}

      {isVideo && (
        <S.Overlay onClick={() => setVideo(false)}>
          <video
            controls
            onClick={(e) => e.stopPropagation()}
            style={{
              borderRadius: 16,
              background: "rgba(0, 0, 0, .2)",
              width: "70%",
            }}
            src={store.getExercise()?.video_url}
          />
          <S.HintButton
            style={{ position: "absolute", top: 64, bottom: "auto", right: 64 }}
            onClick={() => setVideo(false)}
          >
            Закрыть
          </S.HintButton>
        </S.Overlay>
      )}
    </div>
  );
});

ReactDOM.render(<App />, document.getElementById("root"));

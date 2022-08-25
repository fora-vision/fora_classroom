import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";

// @ts-ignore
import logoSrc from "./assets/logo.png";
import { WorkoutRoom, WorkoutState } from "./WorkoutStore";
import { PoseCamera } from "./PoseCamera";
import { observer } from "mobx-react-lite";
import { mobileCheck } from "./helpers";
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
if (jwt === "") {
  store?.generateInvite();
}

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

const Instructions = () => (
  <S.Instructions>
    <h3>Что делать, если система плохо засчитывает выполнения? </h3>

    <h4>Неправильное определение ключевых точек </h4>
    <p>
      Чаще всего проблемы с распознаванием связаны с тем, что неправильно определяются основные точки на теле человека.
      Поэтому понаблюдайте за тем совпадают ли отрисованные точки с реальным положением частей тела и если это не так,
      то:
    </p>
    <p>✅ Убедитесь, что в комнате достаточно светло - модель плохо работает в темноте</p>
    <p>✅ Если скелетик перескакивает на окружающие вас вещи, то отодвиньте их</p>
    <p>✅ Проверьте, что вы полностью помещаетесь в кадр</p>

    <br />
    <h4>{"Маленький FPS (fps < 10)"}</h4>
    <p>
      Низкий fps может быть причиной плохого распознавания. Значение своего fps отображается на экране во время
      тренировки. Если ваш fps меньше 10:
    </p>
    <p>✅ Убедитесь, что у вас стабильное интернет соединение</p>
    <p>
      ✅ Попробуйте выполнить тренировку с другого устройства. <br />
      Чаще всего низкий fps означает нехватку мощностей вашего устройства для распознавания
    </p>
    <p>
      ✅ Если увеличить fps не получилось, то при быстрых упражнениях придется делать задержки в верхней и нижней позе
      упражнения, чтобы система успевала зафиксировать выполнение
    </p>
    <br />

    <h4>{"Неправильное выполнение/положение относительно камеры"}</h4>
    <p>
      ✅ Убедитесь, что вы выполняете тем же боком, что и анимация - это либо лицом, либо левым боком.
      <br /> Упражнения неправильным боком могут хуже засчитываться
    </p>
    <p>
      ✅ Попробуйте сделать "идеальное выполнение" - выполнения с максимальной амплитудой и правильной техникой. Система
      не засчитывает некачественные выполнения
    </p>
  </S.Instructions>
);

const App = observer(() => {
  const [isVideo, setVideo] = useState(false);
  const [isInstructions, setInstructions] = useState(false);

  const [isLoaded, setLoaded] = useState(false);
  const [fps, setFps] = useState(0);

  const hideCamera = !store.exercise || !isLoaded || store.state === WorkoutState.Invite;
  const handleLoaded = () => {
    setLoaded(true);
    if (jwt !== "") {
      void store?.initialize(jwt);
    }
  };

  if (mobileCheck()) {
    return (
      <S.MobileAccess>
        <img src={logoSrc} />
        <h1>Fora.Vision</h1>
        <br />
        <p>Откройте нас через компьютер, чтобы начать тренировку!</p>
      </S.MobileAccess>
    );
  }

  return (
    <div>
      <PoseCamera
        isSavePhotos={store.isSavePhotos}
        style={{ opacity: hideCamera ? 0 : 1 }}
        highlightSkelet={store.highlightSkelet}
        onFrame={store.processFrame}
        onLoaded={handleLoaded}
        onPhoto={store.onPhoto}
        onFps={setFps}
      />

      {!isVideo && isLoaded && store.exercise && (
        <S.Page>
          <S.Screen>
            <S.TopAngle>
              <S.ExerciseTitle>{store.getExercise()?.name}</S.ExerciseTitle>
              <div style={{ display: "flex" }}>
                <S.Badge style={{ marginRight: 8 }}>{fps} FPS</S.Badge>
                {store.isSavePhotos && <S.BadgeRec>REC</S.BadgeRec>}
              </div>
            </S.TopAngle>

            <S.Badges>
              <S.ExerciseCount>{store.exerciseCount}</S.ExerciseCount>
            </S.Badges>

            <S.HelpSide>
              {store.state === WorkoutState.Hint && (
                <ExerciseHint
                  per={2000}
                  frames={[
                    store.getExercise()?.image_down.replace(".png", ".svg"),
                    store.getExercise()?.image_up.replace(".png", ".svg"),
                  ]}
                />
              )}

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                {store.showReplaceButton && (
                  <S.HintButton onClick={() => store.replaceExercise()} style={{ marginRight: 16 }}>
                    Заменить упражнение
                  </S.HintButton>
                )}

                <S.HintButton onClick={() => setInstructions(true)} style={{ marginRight: 16 }}>
                  Плохо распознает?
                </S.HintButton>
                <S.HintButton onClick={() => setVideo(true)}>Показать упражнение</S.HintButton>
              </div>
            </S.HelpSide>
          </S.Screen>
          <S.Timeline>
            <S.TimelineProgress style={{ width: `${store.progress * 100}%` }} />
            <S.TimelineTotal>{formatTime(store.totalTime)}</S.TimelineTotal>
          </S.Timeline>
          <div style={{ display: "flex", justifyContent: "space-between " }}>
            <S.TextTOS>
              Занимаясь тренировками на этом сайте, вы соглашаетесь с{" "}
              <a href="https://fora.vision/tos">условиями пользования</a>
            </S.TextTOS>
            <S.TextTOS style={{ fontWeight: "bold" }}>
              <a href="https://fora.vision">Fora.Vision @2022</a>
            </S.TextTOS>
          </div>
        </S.Page>
      )}

      {store.state === WorkoutState.Complete && (
        <S.Overlay style={{ flexDirection: "column" }}>
          <h1 style={{ color: "#fff" }}>Тренировка завершена!</h1>
          <p style={{ color: "#fff" }}>Можете закрыть страницу, ваш результат сохранен</p>
        </S.Overlay>
      )}

      {store.state === WorkoutState.Error && (
        <S.Overlay style={{ flexDirection: "column" }}>
          <h1 style={{ color: "#fff" }}>{store.error.title}</h1>
          <p style={{ color: "#fff" }}>{store.error.description}</p>
        </S.Overlay>
      )}

      {(!isLoaded || store.state === WorkoutState.Loading) && (
        <S.Overlay>
          <h1 style={{ color: "#fff" }}>Загрузка...</h1>
        </S.Overlay>
      )}

      {store.state === WorkoutState.Invite && (
        <S.MobileAccess style={{ background: "#000" }}>
          <img src={logoSrc} />
          <h1>Fora.Vision</h1>
          <br />
          <p>Откройте нас в Telegram боте, чтобы выбрать тренировку!</p>
        </S.MobileAccess>
      )}

      {isInstructions && (
        <S.Overlay onClick={() => setVideo(false)} style={{ background: "#000000" }}>
          <Instructions />
          <S.HintButton
            style={{ position: "absolute", top: 64, bottom: "auto", right: 64 }}
            onClick={() => setInstructions(false)}
          >
            Закрыть
          </S.HintButton>
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

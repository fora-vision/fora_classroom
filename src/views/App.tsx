import React, { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";

import { formatTime, mobileCheck } from "../helpers";
import { PoseCamera } from "../recognizer/PoseCamera";
import { WorkoutRoom } from "../WorkoutStore";
import { WorkoutState } from "../types";

// @ts-ignore
import logoSrc from "../assets/logo.png";
import Instructions from "./Instructions";
import ExerciseHint from "./ExerciseHint";
import stats, { initStats } from "../stats";
import * as S from "./styled";

const App = observer(({ store, jwt }: { store: WorkoutRoom; jwt: string }) => {
  const [isVideo, setVideo] = useState(false);
  const [isInstructions, setInstructions] = useState(false);
  const [isLoaded, setLoaded] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [fps, setFps] = useState(0);

  const initPerf = useRef(performance.now());

  const ex = store.currentExerciseDetails;
  const hideCamera = !ex || !isLoaded;
  const handleLoaded = async () => {
    setLoaded(true);
    await store?.initialize(jwt);
    initStats.update(performance.now() - initPerf.current);
  };

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((list) => {
      const videos = list.filter((t) => t.kind === "videoinput");
      setSelectedDevice(videos[0].deviceId);
      setDevices(videos);
    });
  }, []);

  if (mobileCheck()) {
    return (
      <S.MobileAccess>
        <img src={logoSrc} />
        <h1>FORA VISION</h1>
        <br />
        <p>Откройте нас через компьютер, чтобы начать тренировку!</p>
      </S.MobileAccess>
    );
  }

  return (
    <div>
      <PoseCamera
        deviceId={selectedDevice}
        isSavePhotos={store.isSavePhotos}
        style={{ opacity: hideCamera ? 0 : 1 }}
        highlightSkelet={store.highlightSkelet}
        onFrame={store.processFrame.bind(store)}
        onLoaded={handleLoaded}
        onPhoto={store.onPhoto}
        onFps={setFps}
      />

      {!isVideo && !hideCamera && (
        <S.Page>
          <S.Screen>
            <S.TopAngle>
              <S.ExerciseTitle>{ex?.name}</S.ExerciseTitle>
              <div style={{ display: "flex" }}>
                <S.Badge style={{ marginRight: 8 }}>{fps} FPS</S.Badge>
                {store.isSavePhotos && <S.BadgeRec>REC</S.BadgeRec>}
              </div>
            </S.TopAngle>

            <S.Badges>
              <S.ExerciseCount>{store.actionsLeftForCurrentExercise}</S.ExerciseCount>
            </S.Badges>

            <S.HelpSide>
              {store.state === WorkoutState.Running && ex != null && (
                <ExerciseHint per={2000} frames={[ex.image_down.replace(".png", ".svg"), ex?.image_up.replace(".png", ".svg")]} />
              )}

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                {/* {store.showReplaceButton && (
                  <S.HintButton onClick={() => store.replaceExercise()} style={{ marginRight: 16 }}>
                    {store.exerciseReplacing ? "Загрузка..." : "Заменить упражнение"}
                  </S.HintButton>
                )} */}

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

          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <S.TextTOS>
              Занимаясь тренировками на этом сайте, вы соглашаетесь с <a href="https://www.fora.vision/tos">условиями пользования</a>
            </S.TextTOS>

            <S.TextTOS onClick={() => (stats.dom.hidden = false)} style={{ fontWeight: "bold", marginLeft: "auto", cursor: "pointer" }}>
              Metrics
            </S.TextTOS>

            <S.TextTOS style={{ fontWeight: "bold" }}>Engine {store.workout?.model_version ?? ""}</S.TextTOS>
            <S.TextTOS style={{ fontWeight: "bold" }}>
              <a href="https://www.fora.vision">FORA VISION @2025</a>
            </S.TextTOS>
          </div>

          <S.Select onChange={(e) => setSelectedDevice(e.target.value)}>
            {devices.map((t) => (
              <option key={t.deviceId} value={t.deviceId}>
                {t.label}
              </option>
            ))}
          </S.Select>
        </S.Page>
      )}

      {store.state === WorkoutState.Complete && (
        <S.Overlay style={{ flexDirection: "column" }}>
          <h1 style={{ color: "#fff", textAlign: "center" }}>Тренировка завершена!</h1>
          <p style={{ color: "#fff", textAlign: "center" }}>Можете закрыть страницу, ваш результат сохранен</p>
        </S.Overlay>
      )}

      {store.state === WorkoutState.Error && (
        <S.Overlay style={{ flexDirection: "column" }}>
          <h1 style={{ color: "#fff", textAlign: "center" }}>{store.error.title}</h1>
          <p style={{ color: "#fff", textAlign: "center" }}>{store.error.description}</p>
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
          <h1>FORA VISION</h1>
          <br />
          <p>Откройте нас в Telegram боте, чтобы выбрать тренировку!</p>
        </S.MobileAccess>
      )}

      {isInstructions && (
        <S.Overlay onClick={() => setVideo(false)} style={{ background: "#000000" }}>
          <Instructions />
          <S.HintButton style={{ position: "absolute", top: 64, bottom: "auto", right: 64 }} onClick={() => setInstructions(false)}>
            Закрыть
          </S.HintButton>
        </S.Overlay>
      )}

      {isVideo && (
        <S.Overlay onClick={() => setVideo(false)}>
          <video controls onClick={(e) => e.stopPropagation()} style={{ borderRadius: 16, background: "rgba(0, 0, 0, .2)", width: "70%" }} src={ex?.video_url} />
          <S.HintButton style={{ position: "absolute", top: 64, bottom: "auto", right: 64 }} onClick={() => setVideo(false)}>
            Закрыть
          </S.HintButton>
        </S.Overlay>
      )}
    </div>
  );
});

export default App;

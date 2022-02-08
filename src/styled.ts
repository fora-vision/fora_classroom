import styled, { keyframes } from "styled-components";

export const Page = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;

  padding: 32px 64px 64px;
`;

export const TextTOS = styled.p`
  margin: 8px 0 -16px;
  color: #333;
  background: rgba(255, 255, 255, 0.5);
  padding: 4px;
  border-radius: 4px;
  font-size: 11px;
  width: fit-content;

  a {
    color: #000;
  }
`

export const Screen = styled.div`
  position: relative;
  margin-bottom: 24px;
  flex: 1;
`;

export const Overlay = styled.div`
  top: 0;
  left: 0;
  position: absolute;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  transition: 0.5s opacity;

  display: flex;
  justify-content: center;
  align-items: center;
`;

export const MobileAccess = styled(Overlay)`
  flex-direction: column;

  img {
    width: 124px;
    height: 124px;
    margin-bottom: 48px;
    border-radius: 24px;
    border: 4px solid #fff;
  }

  p,
  h1 {
    color: #fff;
    padding: 0 24px;
    text-align: center;
    margin: 0;
  }

  a {
    color: #000;
    background: #fff;
    text-decoration: none;
    padding: 16px;
    border-radius: 14px;
    font-size: 16px;
    margin-top: 24px;
  }
`;

export const TopAngle = styled.div`
  max-width: calc(100% - 400px);
  position: absolute;
  top: 0;
  left: 0;
`;

export const Badge = styled.div`
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(60px);
  padding: 16px;
  border-radius: 16px;
  margin-bottom: 8px;

  text-transform: capitalize;
  font-style: normal;
  font-weight: 600;
  font-size: 16px;
  color: #ffffff;
  width: fit-content;
`;

const animation = keyframes`
  0% { opacity: 0 }
  30% { opacity: 1 }
  70% { opacity: 1 }
  100% { opacity: 0 }
`

export const BadgeRec = styled(Badge)`
  display: flex;
  align-items: center;

  &::after {
    content: "";
    display: block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    animation: ${animation} 2s infinite;
    background: tomato;
    margin-left: 8px;
  }
`

export const ExerciseTitle = styled(Badge)`
  font-size: 42px;
  width: 100%;
`;

export const ExerciseCount = styled.h2`
  font-style: normal;
  font-weight: 500;
  font-size: 116px;
  line-height: 141px;

  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(60px);
  padding: 16px;
  border-radius: 16px;
  color: #fff;

  position: absolute;
  left: 0;
  bottom: 0;
  margin: 0;
`;

export const HelpSide = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;

  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-content: flex-end;
`;

export const ExerciseHint = styled.div`
  background: rgba(0, 0, 0, 0.4);
  justify-content: center;
  align-items: center;
  display: flex;

  backdrop-filter: blur(5px);
  box-sizing: border-box;
  padding: 16px;

  flex: 1;
  border-radius: 16px;
  margin-bottom: 16px;
  margin-left: auto;
  width: 350px;

  img {
    width: 100%;
  }
`;

export const HintButton = styled.div`
  cursor: pointer;
  color: #fff;
  padding: 16px;
  background: rgba(2, 2, 9, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-sizing: border-box;
  backdrop-filter: blur(64px);
  border-radius: 16px;
`;

export const Timeline = styled.div`
  width: 100%;
  height: 28px;

  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(64px);
  border-radius: 16px;
`;

export const TimelineProgress = styled.div`
  height: 100%;
  background: #ffffff;
  border-radius: 16px;
  transition: 0.5s width;
`;

export const TimelineTotal = styled.div`
  position: absolute;
  left: 16px;
  top: 4px;

  font-style: normal;
  font-weight: 500;
  font-size: 18px;
  line-height: 21px;
  display: flex;
  align-items: flex-end;
  text-align: center;
  color: #020209;
`;

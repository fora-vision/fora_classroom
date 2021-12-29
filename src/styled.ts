import styled from 'styled-components'

export const Overlay = styled.div`
    top: 0;
    left: 0;
    position: absolute;
    width: 100vw;
    height: 100vh;

    display: flex;
    justify-content: flex-start;
    align-items: flex-end;
`

export const ExerciseWidget = styled.div`
    position: absolute;
    left: 64px;
    bottom: 116px;
    
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(60px);
    padding: 40px 24px;
    display: flex;
    justify-content: flex-start;
    align-items: center;
    border-radius: 16px;
` 

export const ExerciseTitle = styled.h1`
    text-transform: capitalize;
    font-style: normal;
    font-weight: 600;
    font-size: 30px;
    line-height: 37px;
    display: flex;
    align-items: flex-end;
    color: #FFFFFF;
    margin: 0;
    margin-right: 24px;
`

export const ExerciseCount = styled.h2`
    font-style: normal;
    font-weight: 500;
    font-size: 116px;
    line-height: 141px;
    display: flex;
    align-items: flex-end;
    text-align: center;
    color: #FFFFFF;
    margin: 0;
`

export const HintOverlay = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
`

export const HintImage = styled.img`
    width: 30%;
    margin: 0 5%;
`

export const HintButton = styled.div`
    position: absolute;
    bottom: 116px;
    right: 64px;
    cursor: pointer;

    color: #fff;
    padding: 16px;
    background: rgba(2, 2, 9, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.4);
    box-sizing: border-box;
    backdrop-filter: blur(64px);
    border-radius: 16px;
`

export const Timeline = styled.div`
    position: absolute;
    bottom: 64px;
    left: 64px;
    right: 64px;
    height: 28px;

    background: rgba(255, 255, 255, 0.55);
    backdrop-filter: blur(64px);
    border-radius: 16px;
`

export const TimelineProgress = styled.div`
    height: 100%;
    background: #FFFFFF;
    border-radius: 16px;
    transition: .5s width;
`

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
`
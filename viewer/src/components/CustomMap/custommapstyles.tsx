import styled from 'styled-components';
import { colors } from 'src/styles';

export const CustomMapContainer = styled.div`
  position: fixed;
  width: 70vw;
  left: 30vw;
  height: 100%;
  z-index: -10;
`;
export const MapWrapperContainer = styled.div`
  position: absolute;
  left: 0;
  bottom: 0;
  height: 100%;
  width: 100%;
`;

export const UL = styled.ul`
  list-style-type: none;
  margin: 0;
  padding: 0;
`;

export const Li = styled.li`
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 5px;
  color: ${colors.darkgreen};
`;
export const DownloadBtn = styled.div`
  position: relative;
  color: ${colors.darkgreen};
  padding: 5px;
  border-radius: 50%;
  :hover {
    cursor: pointer;
    background-color: rgba(0, 0, 0, 0.2);
  }
`;

export const Popupcontainer = styled.div`
  color: ${colors.darkgreen};
  flex-grow: 1;
`;

export const DownloadToolTipContainer = styled.div`
  position: relative;
  display: flex;
`;

export const DownloadToolTip = styled.div`
  position: absolute;
  display: none;
  background-color: rgba(128, 128, 128, 0.8);
  color: white;
  top: -25px;
  left: 0;
  padding: 3px;
  border-radius: 5px;
  white-space: nowrap;
`;

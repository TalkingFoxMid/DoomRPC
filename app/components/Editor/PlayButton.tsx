import * as React from 'react';
import { Icon, notification } from 'antd';
import * as Mousetrap from 'mousetrap'
import 'mousetrap/plugins/global-bind/mousetrap-global-bind';
import {
  setCall,
  setIsLoading,
  setResponse,
  setResponseStreamData,
  setRequestStreamData, setStreamCommitted
} from './actions';
import { ControlsStateProps } from './Controls';
import { GRPCEventType, GRPCRequest, GRPCEventEmitter, GRPCWebRequest } from '../../behaviour';
import {exec, ExecException} from "child_process";

export const makeRequest = ({ dispatch, state, protoInfo }: ControlsStateProps) => {
  // Do nothing if not set
  if (!protoInfo) {
    return;
  }


  // Cancel the call if ongoing.
  if (state.loading && state.call) {
    state.call.cancel();
    return;
  }

  // Play button action:
  dispatch(setIsLoading(true));

  let grpcRequest : GRPCEventEmitter
  if (state.grpcWeb){
    grpcRequest = new GRPCWebRequest({
      url: state.url,
      inputs: state.data,
      metadata: state.metadata,
      protoInfo,
      interactive: state.interactive,
      tlsCertificate: state.tlsCertificate,
    })
  } else {
    grpcRequest = new GRPCRequest({
      url: state.url,
      inputs: state.data,
      metadata: state.metadata,
      protoInfo,
      interactive: state.interactive,
      tlsCertificate: state.tlsCertificate,
    });
  }

  dispatch(setCall(grpcRequest));

  // Streaming cleanup
  if (grpcRequest.protoInfo.isClientStreaming()) {
    if (state.interactive) {
      dispatch(setRequestStreamData([state.data]));
    } else {
      dispatch(setRequestStreamData([]));
    }
  }

  dispatch(setResponseStreamData([]));
    exec(`/usr/local/bin/grpcurl ${state.insecure ? "-insecure" : ""} -d '${state.data}' ${state.url} ${protoInfo.service.serviceName}/${protoInfo.methodName}\n`, (e: ExecException, sout: string, ssin: string) => {
      dispatch(setResponse({
        responseTime: 666,
        output: sout || e.message,
      }));
    });

  grpcRequest.on(GRPCEventType.END, () => {
    dispatch(setIsLoading(false));
    dispatch(setCall(undefined));
    dispatch(setStreamCommitted(false));

  });

  try {
    grpcRequest.send();
  } catch(e) {
    console.error(e);
    notification.error({
      message: "Error constructing the request",
      description: e.message,
      duration: 5,
      placement: "bottomRight",
      style: {
        width: "100%",
        wordBreak: "break-all",
      }
    });
    grpcRequest.emit(GRPCEventType.END);
  }
};

export function PlayButton({ dispatch, state, protoInfo, active }: ControlsStateProps) {
  React.useEffect(() => {
    if (!active) {
      return
    }
    Mousetrap.bindGlobal(['ctrl+enter', 'command+enter'], () => {
      if (state.loading) {
        return
      }
      makeRequest({ dispatch, state, protoInfo })
    })
  }, [
    // a bit of optimisation here: list all state properties needed in this component
    state.grpcWeb,
    state.url,
    state.data,
    state.metadata,
    state.interactive,
    state.tlsCertificate,
  ])

  return (
    <Icon
      type={state.loading ? "pause-circle" : "play-circle"}
      theme="filled" style={{ ...styles.playIcon, ...(state.loading ? { color: "#ea5d5d" } : {}) }}
      onClick={() => makeRequest({ dispatch, state, protoInfo })}
    />
  )
}

const styles = {
  playIcon: {
    fontSize: 50,
    color: "#ff0000",
    border: "3px solid rgb(238, 238, 238)",
    borderRadius: "50%",
    cursor: "pointer",
    background: "#fff",
  },
};

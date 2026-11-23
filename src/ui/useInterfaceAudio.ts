import {useEffect} from 'react';
import {useApp} from '../app/store';
import {installInterfaceAudio} from './interfaceClick';

// This independent channel follows the existing master/interface volume settings.
export function useInterfaceAudio(){
 useEffect(()=>installInterfaceAudio(document,()=>useApp.getState().settings),[]);
}

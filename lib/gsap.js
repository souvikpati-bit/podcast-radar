'use client';
// GSAP is registered once, here. Only the plugins this app uses are imported.
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { Flip } from 'gsap/Flip';

let registered = false;
export function registerGsap() {
  if (registered || typeof window === 'undefined') return;
  gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, Flip);
  registered = true;
}
registerGsap();

export { gsap, useGSAP, ScrollTrigger, SplitText, Flip };


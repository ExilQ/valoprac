import { ArrowUpRight } from 'lucide-react';
import type { SessionData } from '../engine/types';
import { REVIEW_LAB_URL, reviewLabSessionURL } from './reviewLabTransfer';

export function ReviewLabLink({ session }: { session?: SessionData }) {
  return <a className="secondary-button review-lab-link"
    href={session ? reviewLabSessionURL(session) : REVIEW_LAB_URL}
    target="_blank" rel="noopener noreferrer">
    <ArrowUpRight size={15} aria-hidden="true"/>
    {session ? '이 기록을 복기 연구실로' : '복기 연구실 열기'}
  </a>;
}

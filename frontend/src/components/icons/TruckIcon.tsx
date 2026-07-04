import { SVGProps } from 'react';

export default function TruckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M1 3H15V13H1V3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 5H19L22 8V13H15V5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 18C8.65685 18 10 16.6569 10 15C10 13.3431 8.65685 12 7 12C5.34315 12 4 13.3431 4 15C4 16.6569 5.34315 18 7 18Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 18C18.6569 18 20 16.6569 20 15C20 13.3431 18.6569 12 17 12C15.3431 12 14 13.3431 14 15C14 16.6569 15.3431 18 17 18Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

import { Injectable } from '@angular/core';
import { TableTemplate, TableStyleSettings } from 'src/app/models/table-style.model';


/**
 * Service providing table templates/presets similar to MS Word/PowerPoint
 * Includes professional designs with icon-friendly configurations
 */
@Injectable({
  providedIn: 'root',
})
export class TableTemplatesService {
  /**
   * Enhanced SVG icons library for table columns
   * High-quality, modern icons with proper viewBox and styling
   */
  private readonly commonIcons = {
    // User & People
    user: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    users: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
    userCheck: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline></svg>',
    
    // Communication
    email: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>',
    phone: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>',
    message: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
    bell: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
    
    // Date & Time
    calendar: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
    clock: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    calendarCheck: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><polyline points="9 16 11 18 15 14"></polyline></svg>',
    
    // Location
    location: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
    mapPin: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
    globe: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
    
    // Status & Actions
    check: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    checkCircle: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
    x: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    xCircle: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
    alert: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
    info: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
    
    // Rating & Quality
    star: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
    starFilled: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
    thumbsUp: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>',
    thumbsDown: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg>',
    
    // Money & Finance
    dollar: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
    creditCard: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>',
    wallet: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>',
    trendingUp: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>',
    trendingDown: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>',
    
    // Data & Charts
    chart: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>',
    barChart: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>',
    pieChart: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>',
    activity: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>',
    
    // Settings & Tools
    settings: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M12 1v6m0 6v6m9-9h-6m-6 0H3m15.364 6.364l-4.243-4.243m-4.242 0L5.636 18.364m12.728 0L18.364 5.636M5.636 5.636l4.243 4.243"></path></svg>',
    edit: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
    trash: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
    save: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>',
    download: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>',
    upload: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>',
    
    // Files & Documents
    file: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>',
    folder: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
    image: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>',
    
    // Navigation & Arrows
    arrowRight: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>',
    arrowLeft: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>',
    arrowUp: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>',
    arrowDown: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>',
    
    // Shopping & E-commerce
    shoppingCart: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>',
    package: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>',
    
    // Security & Lock
    lock: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
    unlock: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><circle cx="12" cy="16" r="1"></circle><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>',
    shield: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
    
    // Search & Filter
    search: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="M21 21l-4.35-4.35"></path></svg>',
    filter: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>',
    
    // Other
    heart: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>',
    eye: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
    eyeOff: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>',
    link: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
    copy: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
    share: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>',
  };

  private readonly templates: TableTemplate[] = [
    {
      id: 'premium-blue',
      name: 'Premium Blue',
      description: 'Professional blue gradient header with modern spacing',
      styleSettings: {
        borderColor: '#e0e7ff',
        borderWidth: 0,
        borderStyle: 'solid',
        cellPadding: 14,
        headerBackgroundColor: '#3b82f6',
        headerTextColor: '#ffffff',
        headerBorderColor: '#2563eb',
        headerBorderWidth: 0,
        backgroundColor: '#ffffff',
        textColor: '#1e293b',
        alternateRowColor: '#f8fafc',
        fontSize: 14,
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        headerStyle: {
          fontWeight: 600,
          fontSize: 15,
          textAlign: 'left',
          verticalAlign: 'middle',
        },
        bodyStyle: {
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontSize: 14,
          textColor: '#475569',
        },
      },
    },
    {
      id: 'corporate-elegant',
      name: 'Corporate Elegant',
      description: 'Sophisticated design perfect for business reports',
      styleSettings: {
        borderColor: '#d1d5db',
        borderWidth: 1,
        borderStyle: 'solid',
        cellPadding: 16,
        headerBackgroundColor: '#1f2937',
        headerTextColor: '#ffffff',
        headerBorderColor: '#111827',
        headerBorderWidth: 2,
        backgroundColor: '#ffffff',
        textColor: '#374151',
        alternateRowColor: '#f9fafb',
        fontSize: 14,
        fontFamily: 'Georgia, "Times New Roman", serif',
        headerStyle: {
          fontWeight: 700,
          fontSize: 15,
          textAlign: 'left',
          verticalAlign: 'middle',
        },
        bodyStyle: {
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: 14,
          textColor: '#4b5563',
        },
      },
    },
    {
      id: 'modern-minimal',
      name: 'Modern Minimal',
      description: 'Clean minimal design with subtle borders',
      styleSettings: {
        borderColor: '#e5e7eb',
        borderWidth: 1,
        borderStyle: 'solid',
        cellPadding: 12,
        headerBackgroundColor: '#f9fafb',
        headerTextColor: '#6b7280', // Use consistent gray color
        headerBorderColor: '#e5e7eb',
        headerBorderWidth: 0,
        backgroundColor: '#ffffff',
        textColor: '#1f2937',
        alternateRowColor: '#ffffff',
        fontSize: 14,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        headerStyle: {
          fontWeight: 600,
          fontSize: 13,
          textAlign: 'left',
          verticalAlign: 'middle',
          textColor: '#6b7280', // Consistent with headerTextColor
        },
        bodyStyle: {
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: 14,
          textColor: '#374151',
        },
      },
    },
    {
      id: 'vibrant-purple',
      name: 'Vibrant Purple',
      description: 'Bold purple header with excellent contrast',
      styleSettings: {
        borderColor: '#f3e8ff',
        borderWidth: 0,
        borderStyle: 'solid',
        cellPadding: 13,
        headerBackgroundColor: '#8b5cf6',
        headerTextColor: '#ffffff',
        headerBorderColor: '#7c3aed',
        headerBorderWidth: 0,
        backgroundColor: '#ffffff',
        textColor: '#1f2937',
        alternateRowColor: '#faf5ff',
        fontSize: 14,
        fontFamily: 'Inter, sans-serif',
        headerStyle: {
          fontWeight: 600,
          fontSize: 14,
          textAlign: 'left',
          verticalAlign: 'middle',
        },
        bodyStyle: {
          fontFamily: 'Inter, sans-serif',
          fontSize: 14,
          textColor: '#475569',
        },
      },
    },
    {
      id: 'success-green',
      name: 'Success Green',
      description: 'Fresh green theme perfect for positive data',
      styleSettings: {
        borderColor: '#d1fae5',
        borderWidth: 0,
        borderStyle: 'solid',
        cellPadding: 12,
        headerBackgroundColor: '#10b981',
        headerTextColor: '#ffffff',
        headerBorderColor: '#059669',
        headerBorderWidth: 0,
        backgroundColor: '#ffffff',
        textColor: '#1f2937',
        alternateRowColor: '#f0fdf4',
        fontSize: 14,
        fontFamily: 'Inter, sans-serif',
        headerStyle: {
          fontWeight: 600,
          fontSize: 14,
          textAlign: 'left',
          verticalAlign: 'middle',
        },
        bodyStyle: {
          fontFamily: 'Inter, sans-serif',
          fontSize: 14,
          textColor: '#374151',
        },
      },
    },
    {
      id: 'warm-orange',
      name: 'Warm Orange',
      description: 'Energetic orange design for dynamic content',
      styleSettings: {
        borderColor: '#fed7aa',
        borderWidth: 0,
        borderStyle: 'solid',
        cellPadding: 13,
        headerBackgroundColor: '#f97316',
        headerTextColor: '#ffffff',
        headerBorderColor: '#ea580c',
        headerBorderWidth: 0,
        backgroundColor: '#ffffff',
        textColor: '#1f2937',
        alternateRowColor: '#fff7ed',
        fontSize: 14,
        fontFamily: 'Inter, sans-serif',
        headerStyle: {
          fontWeight: 600,
          fontSize: 14,
          textAlign: 'left',
          verticalAlign: 'middle',
        },
        bodyStyle: {
          fontFamily: 'Inter, sans-serif',
          fontSize: 14,
          textColor: '#475569',
        },
      },
    },
    {
      id: 'dark-mode',
      name: 'Dark Mode',
      description: 'Modern dark theme with excellent readability',
      styleSettings: {
        borderColor: '#374151',
        borderWidth: 1,
        borderStyle: 'solid',
        cellPadding: 12,
        headerBackgroundColor: '#1f2937',
        headerTextColor: '#f9fafb',
        headerBorderColor: '#111827',
        headerBorderWidth: 0,
        backgroundColor: '#111827',
        textColor: '#e5e7eb',
        alternateRowColor: '#1f2937',
        fontSize: 14,
        fontFamily: 'Inter, sans-serif',
        headerStyle: {
          fontWeight: 600,
          fontSize: 14,
          textAlign: 'left',
          verticalAlign: 'middle',
        },
        bodyStyle: {
          fontFamily: 'Inter, sans-serif',
          fontSize: 14,
          textColor: '#d1d5db',
        },
      },
    },
    {
      id: 'grid-professional',
      name: 'Grid Professional',
      description: 'Classic grid layout with clear borders',
      styleSettings: {
        borderColor: '#cbd5e1',
        borderWidth: 1,
        borderStyle: 'solid',
        cellPadding: 11,
        headerBackgroundColor: '#f1f5f9',
        headerTextColor: '#0f172a',
        headerBorderColor: '#cbd5e1',
        headerBorderWidth: 1,
        backgroundColor: '#ffffff',
        textColor: '#1e293b',
        alternateRowColor: '#f8fafc',
        fontSize: 14,
        fontFamily: 'Arial, sans-serif',
        headerStyle: {
          fontWeight: 600,
          fontSize: 14,
          textAlign: 'left',
          verticalAlign: 'middle',
        },
        bodyStyle: {
          fontFamily: 'Arial, sans-serif',
          fontSize: 14,
          textColor: '#334155',
        },
      },
    },
    {
      id: 'soft-pink',
      name: 'Soft Pink',
      description: 'Gentle pink theme with elegant styling',
      styleSettings: {
        borderColor: '#fce7f3',
        borderWidth: 0,
        borderStyle: 'solid',
        cellPadding: 13,
        headerBackgroundColor: '#ec4899',
        headerTextColor: '#ffffff',
        headerBorderColor: '#db2777',
        headerBorderWidth: 0,
        backgroundColor: '#ffffff',
        textColor: '#1f2937',
        alternateRowColor: '#fdf2f8',
        fontSize: 14,
        fontFamily: 'Inter, sans-serif',
        headerStyle: {
          fontWeight: 600,
          fontSize: 14,
          textAlign: 'left',
          verticalAlign: 'middle',
        },
        bodyStyle: {
          fontFamily: 'Inter, sans-serif',
          fontSize: 14,
          textColor: '#475569',
        },
      },
    },
    {
      id: 'ocean-blue',
      name: 'Ocean Blue',
      description: 'Calming blue tones for data visualization',
      styleSettings: {
        borderColor: '#bfdbfe',
        borderWidth: 0,
        borderStyle: 'solid',
        cellPadding: 12,
        headerBackgroundColor: '#0ea5e9',
        headerTextColor: '#ffffff',
        headerBorderColor: '#0284c7',
        headerBorderWidth: 0,
        backgroundColor: '#ffffff',
        textColor: '#1f2937',
        alternateRowColor: '#f0f9ff',
        fontSize: 14,
        fontFamily: 'Inter, sans-serif',
        headerStyle: {
          fontWeight: 600,
          fontSize: 14,
          textAlign: 'left',
          verticalAlign: 'middle',
        },
        bodyStyle: {
          fontFamily: 'Inter, sans-serif',
          fontSize: 14,
          textColor: '#374151',
        },
      },
    },
  ];

  /**
   * Get all available templates
   */
  getTemplates(): TableTemplate[] {
    return [...this.templates];
  }

  /**
   * Get a template by ID
   */
  getTemplate(id: string): TableTemplate | undefined {
    return this.templates.find(t => t.id === id);
  }

  /**
   * Apply template styles to a table style settings object
   */
  applyTemplate(templateId: string, existingSettings?: TableStyleSettings): TableStyleSettings {
    const template = this.getTemplate(templateId);
    if (!template) {
      return existingSettings || {};
    }

    return {
      ...existingSettings,
      ...template.styleSettings,
    };
  }

  /**
   * Get an icon SVG by name
   */
  getIcon(name: keyof typeof this.commonIcons): string {
    return this.commonIcons[name] || '';
  }

  /**
   * Get all available icon names
   */
  getAvailableIcons(): string[] {
    return Object.keys(this.commonIcons);
  }

  /**
   * Get icon suggestion based on column title/keywords
   * Returns icon configuration with proper positioning and styling
   */
  getIconSuggestion(columnTitle: string): {
    svg: string;
    position: 'before' | 'after' | 'below' | 'above';
    size: number;
    color: string;
    margin: number;
  } | null {
    const title = columnTitle.toLowerCase().trim();
    
    // Enhanced map of common column names to icons
    const iconMap: Record<string, keyof typeof this.commonIcons> = {
      // User & People
      'name': 'user',
      'user': 'user',
      'person': 'user',
      'customer': 'user',
      'client': 'user',
      'employee': 'user',
      'member': 'user',
      'users': 'users',
      'team': 'users',
      'people': 'users',
      'verified': 'userCheck',
      
      // Communication
      'email': 'email',
      'mail': 'email',
      'e-mail': 'email',
      'phone': 'phone',
      'telephone': 'phone',
      'mobile': 'phone',
      'contact': 'phone',
      'call': 'phone',
      'message': 'message',
      'notification': 'bell',
      'alert': 'bell',
      
      // Date & Time
      'date': 'calendar',
      'time': 'clock',
      'schedule': 'calendar',
      'appointment': 'calendar',
      'deadline': 'calendarCheck',
      'due': 'calendarCheck',
      'created': 'calendar',
      'updated': 'calendar',
      
      // Location
      'location': 'location',
      'address': 'location',
      'city': 'location',
      'country': 'globe',
      'region': 'mapPin',
      'place': 'location',
      
      // Status & Actions
      'status': 'checkCircle',
      'active': 'checkCircle',
      'approved': 'checkCircle',
      'completed': 'checkCircle',
      'done': 'checkCircle',
      'success': 'checkCircle',
      'inactive': 'xCircle',
      'rejected': 'xCircle',
      'failed': 'xCircle',
      'error': 'alert',
      'warning': 'alert',
      'info': 'info',
      
      // Rating & Quality
      'rating': 'star',
      'score': 'star',
      'review': 'star',
      'quality': 'starFilled',
      'like': 'thumbsUp',
      'dislike': 'thumbsDown',
      
      // Money & Finance
      'price': 'dollar',
      'cost': 'dollar',
      'amount': 'dollar',
      'revenue': 'dollar',
      'sales': 'dollar',
      'payment': 'creditCard',
      'transaction': 'creditCard',
      'wallet': 'wallet',
      'budget': 'wallet',
      'profit': 'trendingUp',
      'loss': 'trendingDown',
      'growth': 'trendingUp',
      
      // Data & Charts
      'chart': 'chart',
      'graph': 'barChart',
      'data': 'chart',
      'analytics': 'activity',
      'statistics': 'pieChart',
      'report': 'barChart',
      
      // Settings & Tools
      'settings': 'settings',
      'config': 'settings',
      'options': 'settings',
      'preferences': 'settings',
      'edit': 'edit',
      'delete': 'trash',
      'remove': 'trash',
      'save': 'save',
      'download': 'download',
      'upload': 'upload',
      
      // Files & Documents
      'file': 'file',
      'document': 'file',
      'folder': 'folder',
      'image': 'image',
      'photo': 'image',
      'picture': 'image',
      
      // Shopping & E-commerce
      'cart': 'shoppingCart',
      'order': 'package',
      'product': 'package',
      'item': 'package',
      
      // Security
      'password': 'lock',
      'security': 'shield',
      'protected': 'lock',
      'private': 'lock',
      
      // Search & Filter
      'search': 'search',
      'filter': 'filter',
      'find': 'search',
      
      // Other
      'favorite': 'heart',
      'view': 'eye',
      'views': 'eye',
      'link': 'link',
      'url': 'link',
      'copy': 'copy',
      'share': 'share',
    };

    // Find matching icon
    for (const [keyword, iconName] of Object.entries(iconMap)) {
      if (title.includes(keyword)) {
        const svg = this.commonIcons[iconName];
        if (svg) {
          return {
            svg,
            position: 'before',
            size: 18,
            color: '#6366f1', // Default indigo color
            margin: 6,
          };
        }
      }
    }

    return null;
  }

  /**
   * Get suggested column configurations with icons for a template
   * Returns array of column suggestions with appropriate icons
   */
  getColumnSuggestionsForTemplate(templateId: string): Array<{
    title: string;
    icon?: string;
    cellType?: 'text' | 'number' | 'currency' | 'icon';
    align?: 'left' | 'center' | 'right';
    widthPx?: number;
    supportsImage?: boolean; // Whether this column can display images
  }> {
    type IconKey = keyof typeof this.commonIcons;
    const suggestions: Record<string, Array<{
      title: string;
      icon?: IconKey;
      cellType?: 'text' | 'number' | 'currency' | 'icon';
      align?: 'left' | 'center' | 'right';
      widthPx?: number;
      supportsImage?: boolean;
    }>> = {
      'premium-blue': [
        { title: 'Name', icon: 'user', widthPx: 150 },
        { title: 'Email', icon: 'email', widthPx: 200 },
        { title: 'Phone', icon: 'phone', widthPx: 140 },
        { title: 'Status', icon: 'checkCircle', align: 'center', widthPx: 100 },
        { title: 'Date', icon: 'calendar', widthPx: 120 },
      ],
      'corporate-elegant': [
        { title: 'Employee', icon: 'user', widthPx: 160 },
        { title: 'Department', icon: 'folder', widthPx: 150 },
        { title: 'Salary', icon: 'dollar', cellType: 'currency', align: 'right', widthPx: 130 },
        { title: 'Join Date', icon: 'calendar', widthPx: 130 },
        { title: 'Status', icon: 'checkCircle', align: 'center', widthPx: 100 },
      ],
      'modern-minimal': [
        { title: 'Product', icon: 'package', widthPx: 180 },
        { title: 'Price', icon: 'dollar', cellType: 'currency', align: 'right', widthPx: 120 },
        { title: 'Stock', icon: 'barChart', cellType: 'number', align: 'center', widthPx: 100 },
        { title: 'Rating', icon: 'star', cellType: 'number', align: 'center', widthPx: 100 },
      ],
      'vibrant-purple': [
        { title: 'Customer', icon: 'user', widthPx: 150 },
        { title: 'Order ID', icon: 'package', widthPx: 140 },
        { title: 'Amount', icon: 'dollar', cellType: 'currency', align: 'right', widthPx: 130 },
        { title: 'Date', icon: 'calendar', widthPx: 120 },
        { title: 'Status', icon: 'checkCircle', align: 'center', widthPx: 100 },
      ],
      'success-green': [
        { title: 'Task', icon: 'checkCircle', widthPx: 200 },
        { title: 'Assignee', icon: 'user', widthPx: 150 },
        { title: 'Due Date', icon: 'calendarCheck', widthPx: 130 },
        { title: 'Priority', icon: 'alert', align: 'center', widthPx: 100 },
        { title: 'Status', icon: 'checkCircle', align: 'center', widthPx: 100 },
      ],
      'warm-orange': [
        { title: 'Product', icon: 'package', widthPx: 180, supportsImage: true },
        { title: 'Name', icon: 'package', widthPx: 200 },
        { title: 'Price', icon: 'dollar', cellType: 'currency', align: 'right', widthPx: 120 },
        { title: 'Sales', icon: 'trendingUp', cellType: 'number', align: 'right', widthPx: 120 },
      ],
      'dark-mode': [
        { title: 'User', icon: 'user', widthPx: 150 },
        { title: 'Email', icon: 'email', widthPx: 200 },
        { title: 'Role', icon: 'settings', widthPx: 120 },
        { title: 'Last Login', icon: 'clock', widthPx: 150 },
      ],
      'grid-professional': [
        { title: 'ID', icon: 'file', align: 'center', widthPx: 80 },
        { title: 'Name', icon: 'user', widthPx: 180 },
        { title: 'Email', icon: 'email', widthPx: 200 },
        { title: 'Phone', icon: 'phone', widthPx: 140 },
        { title: 'Status', icon: 'checkCircle', align: 'center', widthPx: 100 },
      ],
      'soft-pink': [
        { title: 'Customer', icon: 'user', widthPx: 150 },
        { title: 'Avatar', icon: 'image', cellType: 'icon', align: 'center', widthPx: 100, supportsImage: true },
        { title: 'Email', icon: 'email', widthPx: 200 },
        { title: 'Total Orders', icon: 'shoppingCart', cellType: 'number', align: 'center', widthPx: 120 },
      ],
      'ocean-blue': [
        { title: 'Project', icon: 'folder', widthPx: 180 },
        { title: 'Team Lead', icon: 'user', widthPx: 150 },
        { title: 'Budget', icon: 'wallet', cellType: 'currency', align: 'right', widthPx: 130 },
        { title: 'Progress', icon: 'activity', align: 'center', widthPx: 120 },
        { title: 'Deadline', icon: 'calendarCheck', widthPx: 130 },
      ],
    };

    return suggestions[templateId] || [];
  }

  /**
   * Get icon configuration with template-specific styling
   */
  getIconConfigForTemplate(
    templateId: string,
    iconName: keyof typeof this.commonIcons
  ): {
    svg: string;
    position: 'before' | 'after' | 'below' | 'above';
    size: number;
    color: string;
    margin: number;
    backgroundColor?: string;
    borderRadius?: number;
    padding?: number;
  } {
    const template = this.getTemplate(templateId);
    const svg = this.commonIcons[iconName] || '';
    
    // Template-specific icon styling
    const templateIconStyles: Record<string, { color: string; size: number; backgroundColor?: string }> = {
      'premium-blue': { color: '#ffffff', size: 18, backgroundColor: 'rgba(255, 255, 255, 0.2)' },
      'corporate-elegant': { color: '#ffffff', size: 18 },
      'modern-minimal': { color: '#6366f1', size: 16 },
      'vibrant-purple': { color: '#ffffff', size: 18, backgroundColor: 'rgba(255, 255, 255, 0.2)' },
      'success-green': { color: '#ffffff', size: 18, backgroundColor: 'rgba(255, 255, 255, 0.2)' },
      'warm-orange': { color: '#ffffff', size: 18, backgroundColor: 'rgba(255, 255, 255, 0.2)' },
      'dark-mode': { color: '#a78bfa', size: 18 },
      'grid-professional': { color: '#475569', size: 16 },
      'soft-pink': { color: '#ffffff', size: 18, backgroundColor: 'rgba(255, 255, 255, 0.2)' },
      'ocean-blue': { color: '#ffffff', size: 18, backgroundColor: 'rgba(255, 255, 255, 0.2)' },
    };

    const style = templateIconStyles[templateId] || { color: '#6366f1', size: 18 };

    return {
      svg,
      position: 'before',
      size: style.size,
      color: style.color,
      margin: 6,
      backgroundColor: style.backgroundColor,
      borderRadius: style.backgroundColor ? 4 : undefined,
      padding: style.backgroundColor ? 4 : undefined,
    };
  }

  /**
   * Get image configuration for a column
   * Supports both URL and base64 images
   */
  getImageConfig(
    imageUrl: string,
    options?: {
      size?: number;
      borderRadius?: number;
      position?: 'before' | 'after' | 'below' | 'above' | 'only';
      margin?: number;
    }
  ): {
    url: string;
    position: 'before' | 'after' | 'below' | 'above' | 'only';
    size: number;
    margin: number;
    borderRadius?: number;
  } {
    return {
      url: imageUrl,
      position: options?.position || 'before',
      size: options?.size || 40,
      margin: options?.margin || 8,
      borderRadius: options?.borderRadius || 4,
    };
  }

  /**
   * Check if a column title suggests it should support images
   */
  shouldColumnSupportImages(columnTitle: string): boolean {
    const title = columnTitle.toLowerCase().trim();
    const imageKeywords = [
      'avatar', 'photo', 'picture', 'image', 'img', 'thumbnail',
      'logo', 'icon', 'profile', 'picture', 'avatar', 'portrait',
      'banner', 'cover', 'preview', 'gallery'
    ];
    
    return imageKeywords.some(keyword => title.includes(keyword));
  }

  /**
   * Get suggested placeholder image URLs for different use cases
   */
  getPlaceholderImageUrl(type: 'avatar' | 'product' | 'logo' | 'banner' = 'avatar'): string {
    const placeholders: Record<string, string> = {
      avatar: 'https://ui-avatars.com/api/?name=User&background=6366f1&color=fff&size=128',
      product: 'https://via.placeholder.com/150/6366f1/ffffff?text=Product',
      logo: 'https://via.placeholder.com/100/6366f1/ffffff?text=Logo',
      banner: 'https://via.placeholder.com/400x200/6366f1/ffffff?text=Banner',
    };
    
    return placeholders[type] || placeholders['avatar'];
  }

  /**
   * Apply template with column suggestions including icons
   * Returns both style settings and suggested column configurations
   */
  applyTemplateWithColumns(templateId: string): {
    styleSettings: TableStyleSettings;
    columnSuggestions: Array<{
      title: string;
      icon?: string;
      cellType?: 'text' | 'number' | 'currency' | 'icon';
      align?: 'left' | 'center' | 'right';
      widthPx?: number;
      supportsImage?: boolean;
    }>;
  } {
    const styleSettings = this.applyTemplate(templateId);
    const columnSuggestions = this.getColumnSuggestionsForTemplate(templateId);
    
    return {
      styleSettings,
      columnSuggestions,
    };
  }
}

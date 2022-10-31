import newrelic from 'newrelic';

export const errorHandler = (error: any) => newrelic.noticeError(error, { stack: error.stack }); 

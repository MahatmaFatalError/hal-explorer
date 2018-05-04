import {Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpHeaders, HttpResponse} from '@angular/common/http';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/catch';
import {Observable} from 'rxjs/Observable';
import {Subject} from 'rxjs/Subject';
import * as utpl from 'uri-templates';
import {URITemplate} from 'uri-templates';
import {AppService, RequestHeader} from '../app.service';
import * as HttpStatus from 'http-status-codes';

export enum EventType {FillUriTemplate, FillHttpRequest}

export enum Command {Get, Post, Put, Patch, Delete, Document}

export class UriTemplateEvent {
  constructor(public type: EventType, public templatedUrl, public parameters: UrlTemplateParameter[]) {
  }
}

export class HttpRequestEvent {
  constructor(public type: EventType, public command: Command, public uri: string) {
  }
}

export class RequestHeaderEvent {
  constructor(public type: EventType, public command: Command, public uri: string) {
  }
}

export class UrlTemplateParameter {
  constructor(public key: string, public value: string) {
  }
}


@Injectable()
export class RequestService {

  private httpResponse: HttpResponse<any>;
  private responseSubject: Subject<HttpResponse<any>> = new Subject<HttpResponse<any>>();
  private responseObservable: Observable<HttpResponse<any>> = this.responseSubject.asObservable();

  private needInfoSubject: Subject<any> = new Subject<any>();
  private needInfoObservable: Observable<any> = this.needInfoSubject.asObservable();

  private documentationSubject: Subject<string> = new Subject<string>();
  private documentationObservable: Observable<string> = this.documentationSubject.asObservable();

  private requestHeaders: HttpHeaders = new HttpHeaders(
    {
      'Accept': 'application/hal+json, application/json, */*'
    });
  private customRequestHeaders: RequestHeader[];


  constructor(private appService: AppService, private http: HttpClient) {
  }

  public getResponseObservable(): Observable<HttpResponse<any>> {
    return this.responseObservable;
  }

  public getNeedInfoObservable(): Observable<string> {
    return this.needInfoObservable;
  }

  public getDocumentationObservable(): Observable<string> {
    return this.documentationObservable;
  }

  public getUri(uri: string) {
    if (!uri || uri.trim().length === 0) {
      return;
    }

    this.processCommand(Command.Get, uri);
  }

  public requestUri(uri: string, httpMethod: string, body?: string) {
    this.appService.setUrl(uri);
    this.http.request(httpMethod, uri, {headers: this.requestHeaders, observe: 'response', body: body}).subscribe(
      (response: HttpResponse<any>) => {
        (<any>response).statusText = HttpStatus.getStatusText(response.status);
        this.httpResponse = response;
        this.responseSubject.next(response);
      },
      (error: HttpErrorResponse) => {
        const statusText = HttpStatus.getStatusText(error.status);
        if (error.error instanceof ErrorEvent) {
          console.error('An error event occurred:', error.error.message);
        } else {
          // console.error(`Backend returned code ${error.status}, body: ${error.error}`);
          const errorBody = error.error;

          this.httpResponse = new HttpResponse({
            body: errorBody, headers: error.headers,
            status: error.status, statusText: statusText, url: error.url
          });
          this.responseSubject.next(this.httpResponse);
        }
      }
    );
  }

  public processCommand(command: Command, uri: string) {
    if (command === Command.Get) {
      if (uri.includes('{')) {
        const uriTemplate: URITemplate = utpl(uri);
        const uriTemplateParameters: UrlTemplateParameter[] = new Array();
        for (const param of (<any>uriTemplate).varNames) {
          uriTemplateParameters.push(new UrlTemplateParameter(param, ''));
        }

        const event = new UriTemplateEvent(EventType.FillUriTemplate, uri, uriTemplateParameters);
        this.needInfoSubject.next(event);
        return;
      }

      this.requestUri(uri, 'GET');
    } else if (command === Command.Post || command === Command.Put || command === Command.Patch) {
      if (uri.includes('{')) {
        uri = uri.substring(0, uri.indexOf('{'));
      }
      const event = new HttpRequestEvent(EventType.FillHttpRequest, command, uri);
      this.needInfoSubject.next(event);
      return;

    } else if (command === Command.Delete) {
      if (uri.includes('{')) {
        uri = uri.substring(0, uri.indexOf('{'));
      }
      this.requestUri(uri, 'DELETE');

    } else if (command === Command.Document) {
      this.documentationSubject.next(uri);
    } else {
      console.log(('got Command: ' + command));
    }
  }

  setCustomHeaders(requestHeaders: RequestHeader[]) {
    this.requestHeaders = new HttpHeaders(
      {
        'requestHeader.key': 'application/hal+json, application/json, */*'
      });
    for (const requestHeader of requestHeaders) {
      this.requestHeaders = this.requestHeaders.append(requestHeader.key, requestHeader.value);
    }
    this.customRequestHeaders = requestHeaders;
  }
}

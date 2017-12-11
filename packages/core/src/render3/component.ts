/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {ComponentRef, EmbeddedViewRef, Injector} from '../core';

import {assertNotNull} from './assert';
import {NG_HOST_SYMBOL, createError, createViewState, directive, enterView, hostElement, leaveView, locateHostElement, renderComponentOrTemplate} from './instructions';
import {LElement} from './l_node';
import {ComponentDef, ComponentType} from './public_interfaces';
import {RElement, Renderer3, RendererFactory3, domRendererFactory3} from './renderer';
import {notImplemented, stringify} from './util';



/**
 * Options which control how the component should be bootstrapped.
 */
export interface CreateComponentOptionArgs {
  /**
   * Which renderer factory to use.
   */
  rendererFactory?: RendererFactory3;

  /**
   * Which host element should the component be bootstrapped on. If not specified
   * the component definition's `tag` is used to query the existing DOM for the
   * element to bootstrap.
   */
  host?: RElement|string;

  /**
   * Optional Injector which is the Module Injector for the component.
   */
  injector?: Injector;

  /**
   * a set of features which should be applied to this component.
   */
  features?: (<T>(component: T, componentDef: ComponentDef<T>) => void)[];
}


/**
 * Bootstrap a Component into an existing host element and return `ComponentRef`.
 *
 * @param componentType Component to bootstrap
 * @param options Optional parameters which control bootstrapping
 */
export function createComponentRef<T>(
    componentType: ComponentType<T>, opts: CreateComponentOptionArgs): ComponentRef<T> {
  const component = renderComponent(componentType, opts);
  const hostView = createViewRef(detectChanges.bind(component), component);
  return {
    location: {nativeElement: getHostElement(component)},
    injector: opts.injector || NULL_INJECTOR,
    instance: component,
    hostView: hostView,
    changeDetectorRef: hostView,
    componentType: componentType,
    destroy: function() {},
    onDestroy: function(cb: Function): void {}
  };
}

function createViewRef<T>(detectChanges: () => void, context: T): EmbeddedViewRef<T> {
  return addDestroyable(
      {
        // TODO: rootNodes should be replaced when properly implemented
        rootNodes: null !,
        // inherited from core/ChangeDetectorRef
        markForCheck: () => {
          if (ngDevMode) {
            throw notImplemented();
          }
        },
        detach: () => {
          if (ngDevMode) {
            throw notImplemented();
          }
        },
        detectChanges: detectChanges,
        checkNoChanges: () => {
          if (ngDevMode) {
            throw notImplemented();
          }
        },
        reattach: () => {
          if (ngDevMode) {
            throw notImplemented();
          }
        },
      },
      context);
}

interface DestroyRef<T> {
  context: T;
  destroyed: boolean;
  destroy(): void;
  onDestroy(cb: Function): void;
}

function addDestroyable<T, C>(obj: any, context: C): T&DestroyRef<C> {
  let destroyFn: Function[]|null = null;
  obj.destroyed = false;
  obj.destroy = function() {
    destroyFn && destroyFn.forEach((fn) => fn());
    this.destroyed = true;
  };
  obj.onDestroy = (fn: Function) => (destroyFn || (destroyFn = [])).push(fn);
  return obj;
}


// TODO: A hack to not pull in the NullInjector from @angular/core.
export const NULL_INJECTOR: Injector = {
  get: function(token: any, notFoundValue?: any) {
    throw new Error('NullInjector: Not found: ' + stringify(token));
  }
};


/**
 * Bootstrap a Component into an existing host element and return `NgComponent`.
 *
 * NgComponent is a light weight Custom Elements inspired API for bootstrapping and
 * interacting with bootstrapped component.
 *
 * @param componentType Component to bootstrap
 * @param options Optional parameters which control bootstrapping
 */
export function renderComponent<T>(
    componentType: ComponentType<T>, opts: CreateComponentOptionArgs = {}): T {
  const rendererFactory = opts.rendererFactory || domRendererFactory3;
  const componentDef = componentType.ngComponentDef;
  let component: T;
  const hostNode = locateHostElement(rendererFactory, opts.host || componentDef.tag);
  const oldView = enterView(
      createViewState(-1, rendererFactory.createRenderer(hostNode, componentDef.rendererType), []),
      null !);
  try {
    // Create element node at index 0 in data array
    hostElement(hostNode, componentDef);
    // Create directive instance with n() and store at index 1 in data array (el is 0)
    component = directive(1, componentDef.n(), componentDef);
  } finally {
    leaveView(oldView);
  }

  opts.features && opts.features.forEach((feature) => feature(component, componentDef));
  detectChanges(component);
  return component;
}

export function detectChanges<T>(component: T) {
  ngDevMode && assertNotNull(component, 'component');
  const hostNode = (component as any)[NG_HOST_SYMBOL] as LElement;
  if (ngDevMode && !hostNode) {
    createError('Not a directive instance', component);
  }
  ngDevMode && assertNotNull(hostNode.data, 'hostNode.data');
  renderComponentOrTemplate(hostNode, hostNode.view, component);
  isDirty = false;
}

let isDirty = false;
export function markDirty<T>(
    component: T, scheduler: (fn: () => void) => void = requestAnimationFrame) {
  ngDevMode && assertNotNull(component, 'component');
  if (!isDirty) {
    isDirty = true;
    scheduler(detectChanges.bind(null, component));
  }
}

export function getHostElement<T>(component: T): RElement {
  return ((component as any)[NG_HOST_SYMBOL] as LElement).native;
}
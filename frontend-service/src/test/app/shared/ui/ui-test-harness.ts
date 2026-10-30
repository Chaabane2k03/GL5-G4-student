import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

export const setup = async <T>(component: Type<T>): Promise<ComponentFixture<T>> => {
  await TestBed.configureTestingModule({ imports: [component] }).compileComponents();
  return TestBed.createComponent(component);
};

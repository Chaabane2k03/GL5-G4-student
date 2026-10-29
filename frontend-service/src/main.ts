// Must stay the first side-effect import: keycloak-js needs crypto.randomUUID()
// before the first navigation runs the auth guard (see the module comment).
import './app/core/auth/insecure-context-crypto';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

// Enregistrement obligatoire de la locale française (format dates et nombres français)
registerLocaleData(localeFr, 'fr');

bootstrapApplication(AppComponent, appConfig).catch(err => console.error('Erreur bootstrap Cursus:', err));

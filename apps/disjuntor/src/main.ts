import { coletorStdout } from '../../../packages/shared/src/auditoria.ts';
import { escutar, exigir } from '../../../packages/shared/src/nuvem/servidor.ts';
import { criarDisjuntor } from './disjuntor.ts';

escutar(criarDisjuntor({ projeto: exigir('PROJECT_ID'), regiao: exigir('REGIAO'), servicos: exigir('SERVICOS').split(','), coletor: coletorStdout }));

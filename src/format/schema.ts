import { z } from 'zod';
import { erreurDate } from '../model/dates';

export const FORMAT = 'balaina-arbre';
export const VERSION_ACTUELLE = 2;

const identifiant = z.string().min(1, 'identifiant vide');

const datePartielle = z
  .object({
    annee: z.number().int(),
    mois: z.number().int().optional(),
    jour: z.number().int().optional(),
    qualificatif: z.enum(['vers', 'avant', 'apres']).optional(),
  })
  .strict()
  .superRefine((d, ctx) => {
    const e = erreurDate(d);
    if (e) ctx.addIssue({ code: z.ZodIssueCode.custom, message: e });
  });

const personne = z
  .object({
    id: identifiant,
    prenoms: z.string(),
    nom: z.string(),
    autresNoms: z.string().optional(),
    genre: z.string().optional(),
    naissance: datePartielle.optional(),
    deces: z.object({ decede: z.literal(true), date: datePartielle.optional() }).strict().optional(),
    notes: z.string().optional(),
  })
  .strict();

const union = z
  .object({
    id: identifiant,
    partenaires: z
      .array(identifiant)
      .min(1, 'une union a 1 ou 2 partenaires')
      .max(2, 'une union a 1 ou 2 partenaires'),
    type: z.enum(['mariage', 'pacs', 'union_libre', 'non_precise']),
    debut: datePartielle.optional(),
    fin: datePartielle.optional(),
    enfants: z.array(identifiant),
  })
  .strict();

/** Schéma du fichier dans sa version actuelle (après migrations). */
export const schemaFichier = z
  .object({
    format: z.literal(FORMAT),
    version: z.literal(VERSION_ACTUELLE),
    exporteLe: z.string().datetime().optional(),
    personnes: z.array(personne),
    unions: z.array(union),
    affichage: z.object({ ordre: z.array(identifiant) }).strict().optional(),
  })
  .strict();

export type FichierArbre = z.infer<typeof schemaFichier>;

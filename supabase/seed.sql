-- =============================================================
-- Seed: Catálogo de ejercicios
-- Exportado desde prod. Aplicar después de las migraciones.
-- =============================================================

INSERT INTO ejercicios (id, nombre, segmento, patron_movimiento, grupo_muscular, tipo_ejercicio, equipamiento, dificultad_tecnica, instrucciones_base) VALUES
  ('4a0bcd7f-8272-434b-8949-4358481b897a', 'aperturas con mancuerna',            'tren superior', 'empuje',  'pecho',                              'aislado',   'mancuernas', 1, NULL),
  ('86b129c2-fae3-42aa-bb23-42e314321d77', 'bicep martillo',                      'tren superior', 'tracción','bicep',                              'aislado',   'mancuernas', 3, NULL),
  ('1cab79dd-6cc4-42db-8b36-ce1521f61b0d', 'bulgarian split squat',               'tren inferior', 'piernas', 'glúteos;cuadriceps',                  'compuesto', 'mancuernas', 1, NULL),
  ('64a6e284-2093-4053-a09c-a4b19b06eb2b', 'camilla de cuadriceps',               'tren inferior', 'piernas', 'cuadriceps',                          'aislado',   'maquina',    4, NULL),
  ('d129273d-5e8f-4bb7-b594-72238a8130f9', 'curl de bicep con barra',             'tren superior', 'tracción','bicep',                              'aislado',   'barra',      3, NULL),
  ('1a9b96ce-9560-4280-bdbb-46413346eeed', 'curl de bicep con mancuerna',         'tren superior', 'tracción','bicep',                              'aislado',   'mancuernas', 3, NULL),
  ('9de83c22-e79b-42d5-ab5e-a7e6b683cf2c', 'curl en polea baja',                  'tren superior', 'tracción','bicep',                              'aislado',   'maquina',    3, NULL),
  ('3cbb788c-5c44-4bb6-83b8-f2f49831ed63', 'dominadas',                           'tren superior', 'tracción','espalda',                            'compuesto', 'maquina',    2, NULL),
  ('6d5a6b2f-03ae-4d1e-95c7-976f518588c7', 'estocadas c/peso',                    'tren inferior', 'piernas', 'glúteos;cuadriceps',                  'compuesto', 'mancuernas', 2, NULL),
  ('4fd43601-65c8-4a09-86b5-34ef40b6f99b', 'extensión de tríceps en polea alta',  'tren superior', 'empuje',  'tricep',                             'aislado',   'maquina',    3, NULL),
  ('249dff06-f67d-4563-94be-4f6a283af102', 'face pull en polea',                  'tren superior', 'tracción','espalda;hombros',                    'aislado',   'maquina',    3, NULL),
  ('72cd01b2-9e0f-43e5-b0f0-36d89dbb66fd', 'fondos en paralelas',                 'tren superior', 'empuje',  'pecho;tricep',                       'compuesto', 'maquina',    2, NULL),
  ('58242e05-283d-4658-ad4e-b97d38f28cce', 'gemelos parado',                      'tren inferior', 'piernas', 'gemelos',                            'aislado',   'maquina',    3, NULL),
  ('7efd70c6-eae4-4964-ae1c-0029698c04ba', 'gemelos sentado',                     'tren inferior', 'piernas', 'gemelos',                            'aislado',   'maquina',    3, NULL),
  ('3d2d46f0-5ec1-41be-8cf9-5040a7ec1f3f', 'jalón al pecho en polea',             'tren superior', 'tracción','espalda',                            'aislado',   'maquina',    2, NULL),
  ('ccd66cff-da38-46ce-ba2d-e582187a3b91', 'jalón al pecho en polea agarre neutro','tren superior','tracción','espalda',                            'aislado',   'maquina',    2, NULL),
  ('cfeab311-1ddb-4448-a634-cd6ffba800af', 'leg curls',                           'tren inferior', 'piernas', 'isquiotibiales',                     'aislado',   'maquina',    4, NULL),
  ('a6255bd7-2505-47cb-aa84-d4d4c5039b10', 'pecho inclinado c/barra',             'tren superior', 'empuje',  'pecho',                              'compuesto', 'barra',      1, NULL),
  ('7774c61b-cde3-4102-b9ee-95047db59545', 'pecho inclinado c/mancuerna',         'tren superior', 'empuje',  'pecho',                              'compuesto', 'mancuernas', 2, NULL),
  ('5b480cb2-2a68-428e-884c-23f46b671959', 'pecho mariposa',                      'tren superior', 'empuje',  'pecho',                              'aislado',   'maquina',    3, NULL),
  ('011b3d8e-3506-4a54-8ec5-5840ae63c9c1', 'pecho plano',                         'tren superior', 'empuje',  'pecho',                              'compuesto', 'barra',      1, NULL),
  ('a515083f-2f68-4ef8-8ccd-d3ee37bbd64f', 'pecho plano c/mancuerna',             'tren superior', 'empuje',  'pecho',                              'compuesto', 'mancuernas', 2, NULL),
  ('134d317a-7b0b-45b8-8915-9e04ff30210e', 'peso muerto convencional',            'tren inferior', 'piernas', 'glúteos;isquiotibiales;cuadriceps',  'compuesto', 'barra',      1, NULL),
  ('31063c71-99d4-437a-a41d-753595a89909', 'peso muerto rumano',                  'tren inferior', 'piernas', 'isquiotibiales',                     'compuesto', 'barra',      1, NULL),
  ('bdb6320f-3b5e-48b6-9667-1dcd413420df', 'prensa',                              'tren inferior', 'piernas', 'glúteos;cuadriceps',                  'compuesto', 'maquina',    1, NULL),
  ('05bd9b8e-49b1-4e77-99b7-e7921fa4525e', 'press militar c/barra',               'tren superior', 'empuje',  'hombros',                            'compuesto', 'barra',      1, NULL),
  ('810c9173-ad36-4d85-a7c6-cdb8cd9cf4e8', 'press militar c/mancuernas',          'tren superior', 'empuje',  'hombros',                            'aislado',   'mancuernas', 2, NULL),
  ('05f3c2da-cbff-4bdd-9402-22e07a44737c', 'remo c/barra',                        'tren superior', 'tracción','espalda',                            'compuesto', 'barra',      1, NULL),
  ('cd94256e-2db5-4ca3-8118-0788b2f74e59', 'remo en polea baja',                  'tren superior', 'tracción','espalda',                            'aislado',   'maquina',    2, NULL),
  ('dd2fb7c7-34c7-4dcd-85b3-a26d435384de', 'sentadilla c/barra',                  'tren inferior', 'piernas', 'glúteos;cuadriceps',                  'compuesto', 'barra',      1, NULL),
  ('592991e7-e7fd-4929-92a0-a8e98134600a', 'vuelo lateral en polea baja',         'tren superior', 'empuje',  'hombros',                            'aislado',   'maquina',    2, NULL),
  ('1dce3579-31d8-44fa-a8b2-1ef167fa15a1', 'vuelos laterales',                    'tren superior', 'empuje',  'hombros',                            'aislado',   'mancuernas', 2, NULL);

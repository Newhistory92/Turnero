BEGIN TRY

BEGIN TRAN;

-- AlterTable: Ala — agregar columna activa (baja lógica)
ALTER TABLE [dbo].[Ala] ADD [activa] BIT NOT NULL CONSTRAINT [Ala_activa_df] DEFAULT 1;

-- AlterTable: Piso — agregar columna activa (baja lógica)
ALTER TABLE [dbo].[Piso] ADD [activa] BIT NOT NULL CONSTRAINT [Piso_activa_df] DEFAULT 1;

-- AlterTable: SesionOperador — hacer boxId nullable para sesiones de admin sin box

-- Paso 1: eliminar FK y el índice que incluye boxId
ALTER TABLE [dbo].[SesionOperador] DROP CONSTRAINT [SesionOperador_boxId_fkey];
DROP INDEX [SesionOperador_boxId_fin_idx] ON [dbo].[SesionOperador];

-- Paso 2: hacer la columna nullable
ALTER TABLE [dbo].[SesionOperador] ALTER COLUMN [boxId] NVARCHAR(1000) NULL;

-- Paso 3: recrear índice y FK
CREATE NONCLUSTERED INDEX [SesionOperador_boxId_fin_idx] ON [dbo].[SesionOperador]([boxId], [fin]);

ALTER TABLE [dbo].[SesionOperador] ADD CONSTRAINT [SesionOperador_boxId_fkey] FOREIGN KEY ([boxId]) REFERENCES [dbo].[Box]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

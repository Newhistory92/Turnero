BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[AlcanceMetrica] (
    [empleadoId] NVARCHAR(1000) NOT NULL,
    [tramiteId] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [AlcanceMetrica_pkey] PRIMARY KEY CLUSTERED ([empleadoId],[tramiteId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TurnoEvento_empleadoId_timestamp_idx] ON [dbo].[TurnoEvento]([empleadoId], [timestamp]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TurnoEvento_boxId_timestamp_idx] ON [dbo].[TurnoEvento]([boxId], [timestamp]);

-- AddForeignKey
ALTER TABLE [dbo].[AlcanceMetrica] ADD CONSTRAINT [AlcanceMetrica_empleadoId_fkey] FOREIGN KEY ([empleadoId]) REFERENCES [dbo].[Empleado]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AlcanceMetrica] ADD CONSTRAINT [AlcanceMetrica_tramiteId_fkey] FOREIGN KEY ([tramiteId]) REFERENCES [dbo].[Tramite]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

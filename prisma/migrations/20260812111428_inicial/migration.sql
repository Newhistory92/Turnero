BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Sede] (
    [id] NVARCHAR(1000) NOT NULL,
    [nombre] NVARCHAR(1000) NOT NULL,
    [activa] BIT NOT NULL CONSTRAINT [Sede_activa_df] DEFAULT 1,
    CONSTRAINT [Sede_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Ala] (
    [id] NVARCHAR(1000) NOT NULL,
    [sedeId] NVARCHAR(1000) NOT NULL,
    [nombre] NVARCHAR(1000) NOT NULL,
    [orden] INT NOT NULL,
    CONSTRAINT [Ala_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Ala_sedeId_nombre_key] UNIQUE NONCLUSTERED ([sedeId],[nombre])
);

-- CreateTable
CREATE TABLE [dbo].[Piso] (
    [id] NVARCHAR(1000) NOT NULL,
    [sedeId] NVARCHAR(1000) NOT NULL,
    [nombre] NVARCHAR(1000) NOT NULL,
    [nivel] INT NOT NULL,
    CONSTRAINT [Piso_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Piso_sedeId_nivel_key] UNIQUE NONCLUSTERED ([sedeId],[nivel])
);

-- CreateTable
CREATE TABLE [dbo].[Box] (
    [id] NVARCHAR(1000) NOT NULL,
    [alaId] NVARCHAR(1000) NOT NULL,
    [pisoId] NVARCHAR(1000) NOT NULL,
    [numero] INT NOT NULL,
    [nombre] NVARCHAR(1000) NOT NULL,
    [activo] BIT NOT NULL CONSTRAINT [Box_activo_df] DEFAULT 1,
    [horaApertura] VARCHAR(5) NOT NULL,
    [horaCierre] VARCHAR(5) NOT NULL,
    [diasSemana] VARCHAR(7) NOT NULL,
    CONSTRAINT [Box_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Box_alaId_numero_key] UNIQUE NONCLUSTERED ([alaId],[numero])
);

-- CreateTable
CREATE TABLE [dbo].[Categoria] (
    [id] NVARCHAR(1000) NOT NULL,
    [nombre] NVARCHAR(1000) NOT NULL,
    [icono] NVARCHAR(1000) NOT NULL,
    [orden] INT NOT NULL,
    [activa] BIT NOT NULL CONSTRAINT [Categoria_activa_df] DEFAULT 1,
    CONSTRAINT [Categoria_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Tramite] (
    [id] NVARCHAR(1000) NOT NULL,
    [categoriaId] NVARCHAR(1000) NOT NULL,
    [nombre] NVARCHAR(1000) NOT NULL,
    [subtitulo] NVARCHAR(1000) NOT NULL,
    [icono] NVARCHAR(1000) NOT NULL,
    [prefijo] VARCHAR(3) NOT NULL,
    [destinoAlaId] NVARCHAR(1000) NOT NULL,
    [destinoPisoId] NVARCHAR(1000) NOT NULL,
    [horaApertura] VARCHAR(5) NOT NULL,
    [horaCierre] VARCHAR(5) NOT NULL,
    [diasSemana] VARCHAR(7) NOT NULL,
    [duracionMinimaEsperada] INT NOT NULL,
    [orden] INT NOT NULL,
    [activo] BIT NOT NULL CONSTRAINT [Tramite_activo_df] DEFAULT 1,
    CONSTRAINT [Tramite_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[BoxTramite] (
    [boxId] NVARCHAR(1000) NOT NULL,
    [tramiteId] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [BoxTramite_pkey] PRIMARY KEY CLUSTERED ([boxId],[tramiteId])
);

-- CreateTable
CREATE TABLE [dbo].[Turno] (
    [id] NVARCHAR(1000) NOT NULL,
    [numero] VARCHAR(10) NOT NULL,
    [fecha] DATE NOT NULL,
    [tramiteId] NVARCHAR(1000) NOT NULL,
    [dni] VARCHAR(15),
    [nombreAfiliado] NVARCHAR(1000),
    [estado] VARCHAR(15) NOT NULL,
    [boxId] NVARCHAR(1000),
    [requestId] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Turno_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Turno_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Turno_requestId_key] UNIQUE NONCLUSTERED ([requestId])
);

-- CreateTable
CREATE TABLE [dbo].[TurnoEvento] (
    [id] NVARCHAR(1000) NOT NULL,
    [turnoId] NVARCHAR(1000) NOT NULL,
    [tipo] VARCHAR(20) NOT NULL,
    [boxId] NVARCHAR(1000),
    [empleadoId] NVARCHAR(1000),
    [timestamp] DATETIME2 NOT NULL CONSTRAINT [TurnoEvento_timestamp_df] DEFAULT CURRENT_TIMESTAMP,
    [detalle] NVARCHAR(1000),
    CONSTRAINT [TurnoEvento_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Contador] (
    [id] NVARCHAR(1000) NOT NULL,
    [tramiteId] NVARCHAR(1000) NOT NULL,
    [fecha] DATE NOT NULL,
    [valor] INT NOT NULL CONSTRAINT [Contador_valor_df] DEFAULT 0,
    CONSTRAINT [Contador_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Contador_tramiteId_fecha_key] UNIQUE NONCLUSTERED ([tramiteId],[fecha])
);

-- CreateTable
CREATE TABLE [dbo].[Empleado] (
    [id] NVARCHAR(1000) NOT NULL,
    [dniInstitucional] VARCHAR(15) NOT NULL,
    [nombre] NVARCHAR(1000) NOT NULL,
    [rol] VARCHAR(15) NOT NULL,
    [activo] BIT NOT NULL CONSTRAINT [Empleado_activo_df] DEFAULT 1,
    CONSTRAINT [Empleado_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Empleado_dniInstitucional_key] UNIQUE NONCLUSTERED ([dniInstitucional])
);

-- CreateTable
CREATE TABLE [dbo].[EmpleadoBox] (
    [empleadoId] NVARCHAR(1000) NOT NULL,
    [boxId] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [EmpleadoBox_pkey] PRIMARY KEY CLUSTERED ([empleadoId],[boxId])
);

-- CreateTable
CREATE TABLE [dbo].[SesionOperador] (
    [id] NVARCHAR(1000) NOT NULL,
    [empleadoId] NVARCHAR(1000) NOT NULL,
    [boxId] NVARCHAR(1000) NOT NULL,
    [inicio] DATETIME2 NOT NULL CONSTRAINT [SesionOperador_inicio_df] DEFAULT CURRENT_TIMESTAMP,
    [fin] DATETIME2,
    [ultimoLatido] DATETIME2 NOT NULL CONSTRAINT [SesionOperador_ultimoLatido_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [SesionOperador_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Kiosco] (
    [id] NVARCHAR(1000) NOT NULL,
    [nombre] NVARCHAR(1000) NOT NULL,
    [alaId] NVARCHAR(1000),
    [version] NVARCHAR(1000),
    [ultimoLatido] DATETIME2,
    [ultimoErrorImpresion] NVARCHAR(1000),
    CONSTRAINT [Kiosco_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Turno_fecha_estado_idx] ON [dbo].[Turno]([fecha], [estado]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Turno_tramiteId_estado_idx] ON [dbo].[Turno]([tramiteId], [estado]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TurnoEvento_turnoId_idx] ON [dbo].[TurnoEvento]([turnoId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TurnoEvento_timestamp_idx] ON [dbo].[TurnoEvento]([timestamp]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SesionOperador_boxId_fin_idx] ON [dbo].[SesionOperador]([boxId], [fin]);

-- AddForeignKey
ALTER TABLE [dbo].[Ala] ADD CONSTRAINT [Ala_sedeId_fkey] FOREIGN KEY ([sedeId]) REFERENCES [dbo].[Sede]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Piso] ADD CONSTRAINT [Piso_sedeId_fkey] FOREIGN KEY ([sedeId]) REFERENCES [dbo].[Sede]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Box] ADD CONSTRAINT [Box_alaId_fkey] FOREIGN KEY ([alaId]) REFERENCES [dbo].[Ala]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Box] ADD CONSTRAINT [Box_pisoId_fkey] FOREIGN KEY ([pisoId]) REFERENCES [dbo].[Piso]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Tramite] ADD CONSTRAINT [Tramite_categoriaId_fkey] FOREIGN KEY ([categoriaId]) REFERENCES [dbo].[Categoria]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Tramite] ADD CONSTRAINT [Tramite_destinoAlaId_fkey] FOREIGN KEY ([destinoAlaId]) REFERENCES [dbo].[Ala]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Tramite] ADD CONSTRAINT [Tramite_destinoPisoId_fkey] FOREIGN KEY ([destinoPisoId]) REFERENCES [dbo].[Piso]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BoxTramite] ADD CONSTRAINT [BoxTramite_boxId_fkey] FOREIGN KEY ([boxId]) REFERENCES [dbo].[Box]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BoxTramite] ADD CONSTRAINT [BoxTramite_tramiteId_fkey] FOREIGN KEY ([tramiteId]) REFERENCES [dbo].[Tramite]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Turno] ADD CONSTRAINT [Turno_tramiteId_fkey] FOREIGN KEY ([tramiteId]) REFERENCES [dbo].[Tramite]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Turno] ADD CONSTRAINT [Turno_boxId_fkey] FOREIGN KEY ([boxId]) REFERENCES [dbo].[Box]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TurnoEvento] ADD CONSTRAINT [TurnoEvento_turnoId_fkey] FOREIGN KEY ([turnoId]) REFERENCES [dbo].[Turno]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TurnoEvento] ADD CONSTRAINT [TurnoEvento_boxId_fkey] FOREIGN KEY ([boxId]) REFERENCES [dbo].[Box]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TurnoEvento] ADD CONSTRAINT [TurnoEvento_empleadoId_fkey] FOREIGN KEY ([empleadoId]) REFERENCES [dbo].[Empleado]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Contador] ADD CONSTRAINT [Contador_tramiteId_fkey] FOREIGN KEY ([tramiteId]) REFERENCES [dbo].[Tramite]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EmpleadoBox] ADD CONSTRAINT [EmpleadoBox_empleadoId_fkey] FOREIGN KEY ([empleadoId]) REFERENCES [dbo].[Empleado]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EmpleadoBox] ADD CONSTRAINT [EmpleadoBox_boxId_fkey] FOREIGN KEY ([boxId]) REFERENCES [dbo].[Box]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SesionOperador] ADD CONSTRAINT [SesionOperador_empleadoId_fkey] FOREIGN KEY ([empleadoId]) REFERENCES [dbo].[Empleado]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
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

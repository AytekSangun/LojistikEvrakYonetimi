-- CreateTable
CREATE TABLE "Operation" (
    "id" TEXT NOT NULL,
    "operationNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Operation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "taxNumber" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationParticipant" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "globalCompanyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "participantId" TEXT NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Operation_operationNumber_key" ON "Operation"("operationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalCompany_name_key" ON "GlobalCompany"("name");

-- CreateIndex
CREATE INDEX "OperationParticipant_operationId_idx" ON "OperationParticipant"("operationId");

-- CreateIndex
CREATE INDEX "OperationParticipant_globalCompanyId_idx" ON "OperationParticipant"("globalCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "OperationParticipant_operationId_globalCompanyId_role_key" ON "OperationParticipant"("operationId", "globalCompanyId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Document_filePath_key" ON "Document"("filePath");

-- CreateIndex
CREATE INDEX "Document_participantId_idx" ON "Document"("participantId");

-- AddForeignKey
ALTER TABLE "OperationParticipant" ADD CONSTRAINT "OperationParticipant_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationParticipant" ADD CONSTRAINT "OperationParticipant_globalCompanyId_fkey" FOREIGN KEY ("globalCompanyId") REFERENCES "GlobalCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "OperationParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

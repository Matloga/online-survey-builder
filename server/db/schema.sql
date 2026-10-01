-- ============================================================
--  Online Survey Builder - SQL Server schema
--  Run via: npm run migrate  (server/db/migrate.js)
-- ============================================================

IF SCHEMA_ID('dbo') IS NULL EXEC('CREATE SCHEMA dbo');

-- ---------- Users ----------
IF OBJECT_ID('dbo.Users', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users (
        UserId       INT IDENTITY(1,1) PRIMARY KEY,
        Email        NVARCHAR(255) NOT NULL,
        PasswordHash NVARCHAR(255) NOT NULL,
        Name         NVARCHAR(120) NOT NULL,
        Role         NVARCHAR(20)  NOT NULL CONSTRAINT DF_Users_Role DEFAULT ('user'),
        CreatedAt    DATETIME2    NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt    DATETIME2    NOT NULL CONSTRAINT DF_Users_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Users_Email UNIQUE (Email),
        CONSTRAINT CK_Users_Role CHECK (Role IN ('user','admin'))
    );
END;

-- ---------- Surveys ----------
IF OBJECT_ID('dbo.Surveys', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Surveys (
        SurveyId    INT IDENTITY(1,1) PRIMARY KEY,
        OwnerId     INT NOT NULL REFERENCES dbo.Users(UserId) ON DELETE CASCADE,
        Title       NVARCHAR(200) NOT NULL,
        Description NVARCHAR(2000) NULL,
        Category    NVARCHAR(80)  NULL,
        Status      NVARCHAR(20)  NOT NULL CONSTRAINT DF_Surveys_Status DEFAULT ('draft'),
        ShareToken  NVARCHAR(64)  NOT NULL UNIQUE,
        AnonymousResponses BIT NOT NULL CONSTRAINT DF_Surveys_Anon DEFAULT (0),
        AllowMultipleResponses BIT NOT NULL CONSTRAINT DF_Surveys_Multi DEFAULT (0),
        ExpiresAt   DATETIME2     NULL,
        CreatedAt   DATETIME2     NOT NULL CONSTRAINT DF_Surveys_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt   DATETIME2     NOT NULL CONSTRAINT DF_Surveys_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_Surveys_Status CHECK (Status IN ('draft','published','closed'))
    );
    CREATE INDEX IX_Surveys_Owner    ON dbo.Surveys(OwnerId);
    CREATE INDEX IX_Surveys_Status   ON dbo.Surveys(Status);
    CREATE INDEX IX_Surveys_Category ON dbo.Surveys(Category);
END;

-- ---------- Questions ----------
IF OBJECT_ID('dbo.Questions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Questions (
        QuestionId INT IDENTITY(1,1) PRIMARY KEY,
        SurveyId   INT NOT NULL REFERENCES dbo.Surveys(SurveyId) ON DELETE CASCADE,
        Type       NVARCHAR(30) NOT NULL,
        Text       NVARCHAR(500) NOT NULL,
        Required   BIT NOT NULL CONSTRAINT DF_Questions_Required DEFAULT (0),
        -- JSON array of strings, NULL for types that have no options
        Options    NVARCHAR(MAX) NULL,
        -- JSON object for type-specific config (e.g. {"min":1,"max":5})
        Settings   NVARCHAR(MAX) NULL,
        Position   INT NOT NULL CONSTRAINT DF_Questions_Position DEFAULT (0),
        CreatedAt  DATETIME2 NOT NULL CONSTRAINT DF_Questions_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_Questions_Type CHECK (Type IN (
            'short-text','long-text','multiple-choice','checkboxes',
            'dropdown','rating','yes-no'
        ))
    );
    CREATE INDEX IX_Questions_Survey ON dbo.Questions(SurveyId, Position);
END;

-- ---------- Responses ----------
IF OBJECT_ID('dbo.Responses', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Responses (
        ResponseId  INT IDENTITY(1,1) PRIMARY KEY,
        SurveyId    INT NOT NULL REFERENCES dbo.Surveys(SurveyId) ON DELETE CASCADE,
        -- NULL when the survey allows anonymous responses
        RespondentId INT NULL REFERENCES dbo.Users(UserId) ON DELETE SET NULL,
        SubmittedAt DATETIME2 NOT NULL CONSTRAINT DF_Responses_SubmittedAt DEFAULT SYSUTCDATETIME(),
        -- Set for one-per-device duplicate prevention when not logged in
        GuestKey    NVARCHAR(64) NULL,
        UserAgent   NVARCHAR(300) NULL
    );
    CREATE INDEX IX_Responses_Survey ON dbo.Responses(SurveyId, SubmittedAt);
END;

-- One response per respondent per survey (filtered index: NULLs excluded)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Responses_SurveyRespondent')
    CREATE UNIQUE INDEX UX_Responses_SurveyRespondent
        ON dbo.Responses(SurveyId, RespondentId)
        WHERE RespondentId IS NOT NULL;

-- One response per guest per survey
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Responses_SurveyGuest')
    CREATE UNIQUE INDEX UX_Responses_SurveyGuest
        ON dbo.Responses(SurveyId, GuestKey)
        WHERE GuestKey IS NOT NULL;

-- ---------- Answers ----------
IF OBJECT_ID('dbo.Answers', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Answers (
        AnswerId   INT IDENTITY(1,1) PRIMARY KEY,
        ResponseId INT NOT NULL REFERENCES dbo.Responses(ResponseId) ON DELETE CASCADE,
        QuestionId INT NOT NULL REFERENCES dbo.Questions(QuestionId) ON DELETE CASCADE,
        -- Scalars are stored typed so analytics can aggregate in SQL
        ValueText   NVARCHAR(MAX) NULL,
        ValueNumber FLOAT NULL,
        -- Arrays (checkboxes) stored as JSON array of strings
        ValueJson   NVARCHAR(MAX) NULL
    );
    CREATE INDEX IX_Answers_Response ON dbo.Answers(ResponseId);
    CREATE INDEX IX_Answers_Question ON dbo.Answers(QuestionId);
END;